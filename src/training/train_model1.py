import argparse
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.models.siamese_unet import SiameseUNet


CHANGE_DATASET_DIR = Path("data/change_dataset")
CHECKPOINT_PATH = Path("models/siamese_unet.pth")

DEFAULT_BATCH_SIZE = 4
DEFAULT_EPOCHS = 15
DEFAULT_LR = 1e-4
DEFAULT_PATIENCE = 10
TARGET_SIZE = (256, 256)
PREDICTION_THRESHOLD = 0.5
IGNORE_LABEL = 255
LOSS_EPS = 1e-7
SANITIZED_KEYS = ("T1", "T2", "label", "mask")


class ChangeDetectionDataset(Dataset):
    def __init__(self, split_dir, target_size=TARGET_SIZE):
        self.split_dir = Path(split_dir)
        self.target_size = target_size
        self.sample_paths = sorted(self.split_dir.glob("*/*.npz"))

        if not self.sample_paths:
            raise FileNotFoundError(f"No .npz samples found in {self.split_dir}")

    def __len__(self):
        return len(self.sample_paths)

    def resize_image_tensor(self, tensor):
        tensor = tensor.unsqueeze(0)
        tensor = F.interpolate(
            tensor,
            size=self.target_size,
            mode="bilinear",
            align_corners=False,
        )
        return tensor.squeeze(0)

    def resize_mask_tensor(self, tensor):
        tensor = tensor.unsqueeze(0).unsqueeze(0)
        tensor = F.interpolate(
            tensor,
            size=self.target_size,
            mode="nearest",
        )
        return tensor.squeeze(0).squeeze(0)

    def __getitem__(self, index):
        sample_path = self.sample_paths[index]

        with np.load(sample_path) as sample:
            t1 = sample["T1"].astype(np.float32)
            t2 = sample["T2"].astype(np.float32)
            label = sample["label"].astype(np.float32)
            mask = sample["mask"].astype(np.float32)

        t1 = np.transpose(t1, (2, 0, 1))
        t2 = np.transpose(t2, (2, 0, 1))

        t1 = torch.from_numpy(t1)
        t2 = torch.from_numpy(t2)
        label = torch.from_numpy(label)
        mask = torch.from_numpy(mask)

        t1 = self.resize_image_tensor(t1)
        t2 = self.resize_image_tensor(t2)
        label = self.resize_mask_tensor(label)
        mask = self.resize_mask_tensor(mask)

        label = torch.where(label == IGNORE_LABEL, torch.zeros_like(label), label)

        return {
            "T1": t1,
            "T2": t2,
            "label": label,
            "mask": mask,
        }


def create_dataloaders(dataset_dir, batch_size, num_workers):
    train_dataset = ChangeDetectionDataset(dataset_dir / "train")
    val_dataset = ChangeDetectionDataset(dataset_dir / "val")

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available(),
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available(),
    )

    return train_loader, val_loader


def masked_bce_loss(logits, labels, masks, criterion):
    pixel_loss = criterion(logits, labels)
    valid_pixels = masks.sum().clamp_min(LOSS_EPS)

    return (pixel_loss * masks).sum() / valid_pixels


def update_metric_counts(logits, labels, masks, counts):
    probabilities = torch.sigmoid(logits)
    predictions = probabilities >= PREDICTION_THRESHOLD
    targets = labels >= 0.5
    valid = masks > 0.5

    predictions = predictions[valid]
    targets = targets[valid]

    if predictions.numel() == 0:
        return

    counts["tp"] += torch.logical_and(predictions, targets).sum().item()
    counts["fp"] += torch.logical_and(predictions, ~targets).sum().item()
    counts["fn"] += torch.logical_and(~predictions, targets).sum().item()


def compute_metrics(counts, eps=1e-7):
    tp = counts["tp"]
    fp = counts["fp"]
    fn = counts["fn"]

    precision = tp / (tp + fp + eps)
    recall = tp / (tp + fn + eps)
    iou = tp / (tp + fp + fn + eps)
    f1 = (2.0 * precision * recall) / (precision + recall + eps)

    return {
        "iou": iou,
        "f1": f1,
        "precision": precision,
        "recall": recall,
    }


def move_batch_to_device(batch, device):
    batch = {
        key: value.to(device, non_blocking=True)
        for key, value in batch.items()
    }

    if batch["label"].dim() == 3:
        batch["label"] = batch["label"].unsqueeze(1)

    if batch["mask"].dim() == 3:
        batch["mask"] = batch["mask"].unsqueeze(1)

    return batch


def sanitize_batch(batch):
    invalid_counts = {}

    for key in SANITIZED_KEYS:
        invalid_mask = ~torch.isfinite(batch[key])
        invalid_count = int(invalid_mask.sum().item())
        invalid_counts[key] = invalid_count

        if invalid_count > 0:
            batch[key] = torch.nan_to_num(
                batch[key],
                nan=0.0,
                posinf=0.0,
                neginf=0.0,
            )

    return batch, invalid_counts


def update_sanitization_summary(summary, invalid_counts):
    sanitized = any(count > 0 for count in invalid_counts.values())

    if sanitized:
        summary["batches"] += 1

    for key, count in invalid_counts.items():
        summary[key] += count


def print_sanitization_summary(split_name, summary):
    details = " ".join(
        f"{key}={summary[key]}"
        for key in SANITIZED_KEYS
        if summary[key] > 0
    )

    if details:
        print(
            f"  {split_name} sanitization: "
            f"{summary['batches']} batches sanitized ({details})"
        )
    else:
        print(f"  {split_name} sanitization: 0 batches sanitized")


def print_cuda_device_summary(device):
    cuda_available = torch.cuda.is_available()
    device_count = torch.cuda.device_count()
    gpu_name = torch.cuda.get_device_name(0) if cuda_available else "N/A"

    print("\nCUDA verification")
    print(f"  CUDA available: {cuda_available}")
    print(f"  Selected device: {device}")
    print(f"  GPU name: {gpu_name}")
    print(f"  CUDA device count: {device_count}")


def print_epoch_gpu_memory():
    if torch.cuda.is_available():
        allocated_mb = torch.cuda.memory_allocated() / (1024 ** 2)
        reserved_mb = torch.cuda.memory_reserved() / (1024 ** 2)
    else:
        allocated_mb = 0.0
        reserved_mb = 0.0

    print("  GPU memory")
    print(f"    allocated: {allocated_mb:.2f} MB")
    print(f"    reserved: {reserved_mb:.2f} MB")


def train_one_epoch(
    model,
    loader,
    optimizer,
    criterion,
    device,
    log_first_batch_devices=False,
):
    model.train()

    total_loss = 0.0
    total_valid_pixels = 0.0
    counts = {"tp": 0.0, "fp": 0.0, "fn": 0.0}
    sanitization_summary = {"batches": 0, "T1": 0, "T2": 0, "label": 0, "mask": 0}

    for batch_index, batch in enumerate(loader, start=1):
        batch = move_batch_to_device(batch, device)

        batch, invalid_counts = sanitize_batch(batch)
        update_sanitization_summary(sanitization_summary, invalid_counts)

        if log_first_batch_devices and batch_index == 1:
            print("  First training batch device verification")
            print(f"    T1 device: {batch['T1'].device}")
            print(f"    T2 device: {batch['T2'].device}")
            print(f"    label device: {batch['label'].device}")
            print(f"    mask device: {batch['mask'].device}")

        valid_pixels = batch["mask"].sum().item()
        if valid_pixels <= 0:
            print(
                f"    WARNING: skipping train batch {batch_index}/{len(loader)} "
                "because it has zero valid pixels"
            )
            continue

        optimizer.zero_grad(set_to_none=True)

        logits = model(batch["T1"], batch["T2"])

        loss = masked_bce_loss(logits, batch["label"], batch["mask"], criterion)

        if log_first_batch_devices and batch_index == 1:
            print(f"    logits device: {logits.device}")
            print(f"    loss device: {loss.device}")

        if not torch.isfinite(loss):
            print(
                f"    WARNING: skipping train batch {batch_index}/{len(loader)} "
                f"because loss is not finite: {loss.item()}"
            )
            continue

        loss.backward()

        if log_first_batch_devices and batch_index == 1:
            first_grad = next(
                (
                    parameter.grad
                    for parameter in model.parameters()
                    if parameter.grad is not None
                ),
                None,
            )
            gradient_device = first_grad.device if first_grad is not None else "N/A"
            print(f"    gradient device: {gradient_device}")

        optimizer.step()

        total_loss += loss.item() * valid_pixels
        total_valid_pixels += valid_pixels

        update_metric_counts(logits.detach(), batch["label"], batch["mask"], counts)

        print(
            f"    train batch {batch_index}/{len(loader)} "
            f"loss={loss.item():.6f}"
        )

    average_loss = total_loss / max(total_valid_pixels, 1.0)
    metrics = compute_metrics(counts)
    print_sanitization_summary("Train", sanitization_summary)

    return average_loss, metrics


@torch.no_grad()
def validate_one_epoch(model, loader, criterion, device):
    model.eval()

    total_loss = 0.0
    total_valid_pixels = 0.0
    counts = {"tp": 0.0, "fp": 0.0, "fn": 0.0}
    sanitization_summary = {"batches": 0, "T1": 0, "T2": 0, "label": 0, "mask": 0}

    for batch_index, batch in enumerate(loader, start=1):
        batch = move_batch_to_device(batch, device)
        batch, invalid_counts = sanitize_batch(batch)
        update_sanitization_summary(sanitization_summary, invalid_counts)

        valid_pixels = batch["mask"].sum().item()
        if valid_pixels <= 0:
            print(
                f"    WARNING: skipping val batch {batch_index}/{len(loader)} "
                "because it has zero valid pixels"
            )
            continue

        logits = model(batch["T1"], batch["T2"])
        loss = masked_bce_loss(logits, batch["label"], batch["mask"], criterion)

        if not torch.isfinite(loss):
            print(
                f"    WARNING: skipping val batch {batch_index}/{len(loader)} "
                f"because loss is not finite: {loss.item()}"
            )
            continue

        total_loss += loss.item() * valid_pixels
        total_valid_pixels += valid_pixels

        update_metric_counts(logits, batch["label"], batch["mask"], counts)

        print(
            f"    val batch {batch_index}/{len(loader)} "
            f"loss={loss.item():.6f}"
        )

    average_loss = total_loss / max(total_valid_pixels, 1.0)
    metrics = compute_metrics(counts)
    print_sanitization_summary("Val", sanitization_summary)

    return average_loss, metrics


def save_checkpoint(path, model, optimizer, epoch, best_val_loss, val_loss, val_metrics):
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "epoch": epoch,
            "model_state_dict": model.state_dict(),
            "optimizer_state_dict": optimizer.state_dict(),
            "best_val_loss": best_val_loss,
            "val_loss": val_loss,
            "val_metrics": val_metrics,
        },
        path,
    )


def load_checkpoint(path, model, optimizer, device):
    if not path.exists():
        print(f"\nCheckpoint not found: {path}")
        print("Starting fresh training")
        return 1, float("inf")

    print(f"\nCheckpoint found: {path}")
    checkpoint = torch.load(path, map_location=device)

    if not isinstance(checkpoint, dict) or "model_state_dict" not in checkpoint:
        model.load_state_dict(checkpoint)
        print("Loaded model weights only checkpoint")
        print("Optimizer state, epoch, and best validation loss were not available")
        print("Starting fresh training schedule from epoch 1")
        return 1, float("inf")

    model.load_state_dict(checkpoint["model_state_dict"])

    if "optimizer_state_dict" in checkpoint:
        optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
    else:
        print("Optimizer state missing from checkpoint; using a fresh optimizer")

    completed_epoch = int(checkpoint.get("epoch", 0))
    start_epoch = completed_epoch + 1
    best_val_loss = checkpoint.get("best_val_loss", checkpoint.get("val_loss", float("inf")))
    best_val_loss = float(best_val_loss)

    print(f"Resumed from epoch: {completed_epoch}")
    print(f"Next epoch: {start_epoch}")
    print(f"Restored best validation loss: {best_val_loss:.6f}")

    return start_epoch, best_val_loss


def train(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    print_cuda_device_summary(device)

    train_loader, val_loader = create_dataloaders(
        args.dataset_dir,
        args.batch_size,
        args.num_workers,
    )

    print(f"Train samples: {len(train_loader.dataset)}")
    print(f"Val samples: {len(val_loader.dataset)}")

    model = SiameseUNet(in_channels=10, out_channels=1).to(device)
    print("\nModel device verification")
    print(f"  parameter device: {next(model.parameters()).device}")

    criterion = nn.BCEWithLogitsLoss(reduction="none")
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)

    start_epoch, best_val_loss = load_checkpoint(
        args.checkpoint,
        model,
        optimizer,
        device,
    )
    epochs_without_improvement = 0

    if start_epoch > args.epochs:
        print(
            "\nCheckpoint already reached or exceeded the requested "
            f"epoch count ({args.epochs}). Nothing to train."
        )
        return

    for epoch in range(start_epoch, args.epochs + 1):
        print(f"\nEpoch {epoch}/{args.epochs}")
        print_epoch_gpu_memory()

        train_loss, train_metrics = train_one_epoch(
            model,
            train_loader,
            optimizer,
            criterion,
            device,
            log_first_batch_devices=(epoch == start_epoch),
        )
        val_loss, val_metrics = validate_one_epoch(
            model,
            val_loader,
            criterion,
            device,
        )

        print(
            "  "
            f"train_loss={train_loss:.6f} "
            f"val_loss={val_loss:.6f} "
            f"IoU={val_metrics['iou']:.4f} "
            f"F1={val_metrics['f1']:.4f} "
            f"precision={val_metrics['precision']:.4f} "
            f"recall={val_metrics['recall']:.4f}"
        )

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            epochs_without_improvement = 0
            print("  Validation improved")
        else:
            epochs_without_improvement += 1
            print(
                "  "
                f"No validation improvement "
                f"({epochs_without_improvement}/{args.patience})"
            )

        save_checkpoint(
            args.checkpoint,
            model,
            optimizer,
            epoch,
            best_val_loss,
            val_loss,
            val_metrics,
        )
        print(f"  Saved checkpoint: {args.checkpoint}")

        if epochs_without_improvement >= args.patience:
            print("Early stopping triggered")
            break


def parse_args():
    parser = argparse.ArgumentParser(
        description="Train Siamese U-Net for binary satellite change detection."
    )
    parser.add_argument("--dataset-dir", type=Path, default=CHANGE_DATASET_DIR)
    parser.add_argument("--checkpoint", type=Path, default=CHECKPOINT_PATH)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    parser.add_argument("--lr", type=float, default=DEFAULT_LR)
    parser.add_argument("--patience", type=int, default=DEFAULT_PATIENCE)
    parser.add_argument("--num-workers", type=int, default=0)
    return parser.parse_args()


def main():
    args = parse_args()
    train(args)


if __name__ == "__main__":
    main()
