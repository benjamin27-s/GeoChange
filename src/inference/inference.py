import argparse
import json
import random
import re
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn.functional as F


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.models.convlstm import ConvLSTM


TEST_DATASET_DIR = Path("data/sequence_dataset/test")
CHECKPOINT_PATH = Path("models/convlstm.pth")
NORMALIZATION_STATS_PATH = Path("normalization_stats.json")
OUTPUT_DIR = Path("outputs/inference")

DEFAULT_N_SAMPLES = 5
TARGET_SIZE = (256, 256)
NORMALIZED_CHANNELS = 9
INPUT_CHANNELS = 10
RGB_CHANNEL_INDICES = (2, 1, 0)  # B4, B3, B2
EPS = 1e-7


def load_normalization_stats(stats_path):
    with stats_path.open("r", encoding="utf-8") as file:
        stats = json.load(file)

    mean = torch.tensor(stats["mean"], dtype=torch.float32).view(1, -1, 1, 1)
    std = torch.tensor(stats["std"], dtype=torch.float32).view(1, -1, 1, 1)
    std = torch.where(std == 0.0, torch.ones_like(std), std)

    if mean.shape[1] != NORMALIZED_CHANNELS or std.shape[1] != NORMALIZED_CHANNELS:
        raise ValueError(
            "normalization_stats.json must contain 9 means and 9 standard deviations"
        )

    return mean, std


def discover_samples(test_dir):
    sample_paths = sorted(test_dir.glob("*/*.npz"))

    if not sample_paths:
        raise FileNotFoundError(f"No .npz samples found in {test_dir}")

    return sample_paths


def select_samples(sample_paths, n_samples, seed=None):
    n_selected = min(n_samples, len(sample_paths))
    rng = random.Random(seed)
    return rng.sample(sample_paths, n_selected)


def resize_sequence_tensor(tensor, target_size=TARGET_SIZE):
    return F.interpolate(
        tensor,
        size=target_size,
        mode="bilinear",
        align_corners=False,
    )


def resize_target_tensor(tensor, target_size=TARGET_SIZE):
    tensor = tensor.unsqueeze(0)
    tensor = F.interpolate(
        tensor,
        size=target_size,
        mode="bilinear",
        align_corners=False,
    )
    return tensor.squeeze(0)


def resize_mask_tensor(tensor, target_size=TARGET_SIZE):
    tensor = tensor.unsqueeze(0).unsqueeze(0)
    tensor = F.interpolate(tensor, size=target_size, mode="nearest")
    return tensor.squeeze(0).squeeze(0)


def load_sample(sample_path):
    with np.load(sample_path) as sample:
        x = sample["x"].astype(np.float32)
        target = sample["target"].astype(np.float32)
        mask = sample["mask"].astype(np.float32)

    if x.ndim != 4 or x.shape[0] != 3 or x.shape[-1] != INPUT_CHANNELS:
        raise ValueError(f"Expected x shape (3,H,W,10), got {x.shape}")

    if target.ndim != 3 or target.shape[-1] != NORMALIZED_CHANNELS:
        raise ValueError(f"Expected target shape (H,W,9), got {target.shape}")

    if mask.ndim != 2:
        raise ValueError(f"Expected mask shape (H,W), got {mask.shape}")

    # x: (3,H,W,10) -> (3,10,H,W)
    x = torch.from_numpy(np.transpose(x, (0, 3, 1, 2)))
    # target: (H,W,9) -> (9,H,W)
    target = torch.from_numpy(np.transpose(target, (2, 0, 1)))
    mask = torch.from_numpy(mask)

    x = resize_sequence_tensor(x)
    target = resize_target_tensor(target)
    mask = resize_mask_tensor(mask)

    x = torch.nan_to_num(x, nan=0.0, posinf=0.0, neginf=0.0)
    target = torch.nan_to_num(target, nan=0.0, posinf=0.0, neginf=0.0)
    mask = torch.nan_to_num(mask, nan=0.0, posinf=0.0, neginf=0.0)

    return x.unsqueeze(0), target, mask


def infer_model_shape(model_state_dict):
    encoder_weight = model_state_dict.get("encoder.0.weight")
    head_weight = model_state_dict.get("prediction_head.0.weight")

    if encoder_weight is None or head_weight is None:
        return 64, 64

    feature_channels = int(encoder_weight.shape[0])
    hidden_channels = int(head_weight.shape[1])

    return feature_channels, hidden_channels


def load_model(checkpoint_path, device):
    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")

    checkpoint = torch.load(checkpoint_path, map_location=device)
    model_state_dict = checkpoint.get("model_state_dict", checkpoint)

    if not isinstance(model_state_dict, dict):
        raise ValueError("Checkpoint does not contain a valid model state dict")

    feature_channels, hidden_channels = infer_model_shape(model_state_dict)
    model = ConvLSTM(
        input_channels=INPUT_CHANNELS,
        output_channels=NORMALIZED_CHANNELS,
        feature_channels=feature_channels,
        hidden_channels=hidden_channels,
    ).to(device)
    model.load_state_dict(model_state_dict)
    model.eval()

    return model


def denormalize(tensor, mean, std):
    mean = mean.to(device=tensor.device, dtype=tensor.dtype)
    std = std.to(device=tensor.device, dtype=tensor.dtype)
    return tensor * std + mean


def to_rgb_image(tensor_9chw):
    rgb = tensor_9chw[list(RGB_CHANNEL_INDICES)].detach().cpu().numpy()
    rgb = np.transpose(rgb, (1, 2, 0))
    return np.clip(rgb, 0.0, 1.0)


def make_sample_slug(sample_path):
    raw_name = f"{sample_path.parent.name}_{sample_path.stem}"
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", raw_name)


def compute_metrics(prediction, target, mask):
    mask = (mask > 0.5).to(dtype=prediction.dtype, device=prediction.device)
    mask = mask.unsqueeze(0)
    valid_pixels = mask.sum().clamp_min(EPS)

    error = prediction - target
    mae = (error.abs() * mask).sum() / (valid_pixels * prediction.shape[0])
    mse = ((error * error) * mask).sum() / (valid_pixels * prediction.shape[0])

    return mae.item(), mse.item()


def plot_comparison(sample_path, x_denorm, target_denorm, prediction_denorm, output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)

    t1_rgb = to_rgb_image(x_denorm[0, :NORMALIZED_CHANNELS])
    t2_rgb = to_rgb_image(x_denorm[1, :NORMALIZED_CHANNELS])
    t3_rgb = to_rgb_image(x_denorm[2, :NORMALIZED_CHANNELS])
    real_rgb = to_rgb_image(target_denorm)
    predicted_rgb = to_rgb_image(prediction_denorm)

    difference = torch.mean(
        torch.abs(prediction_denorm - target_denorm),
        dim=0,
    ).detach().cpu().numpy()

    figure = plt.figure(figsize=(15, 12), constrained_layout=True)
    grid = figure.add_gridspec(3, 6, height_ratios=[1.0, 1.0, 1.1])

    axes = [
        figure.add_subplot(grid[0, 0:2]),
        figure.add_subplot(grid[0, 2:4]),
        figure.add_subplot(grid[0, 4:6]),
        figure.add_subplot(grid[1, 0:3]),
        figure.add_subplot(grid[1, 3:6]),
        figure.add_subplot(grid[2, :]),
    ]
    images = [t1_rgb, t2_rgb, t3_rgb, real_rgb, predicted_rgb]
    titles = ["T1 RGB", "T2 RGB", "T3 RGB", "Real T4", "Predicted T4"]

    for axis, image, title in zip(axes[:5], images, titles):
        axis.imshow(image)
        axis.set_title(title)
        axis.axis("off")

    heatmap = axes[5].imshow(difference, cmap="magma")
    axes[5].set_title("Absolute Difference Heatmap")
    axes[5].axis("off")
    figure.colorbar(heatmap, ax=axes[5], fraction=0.025, pad=0.02)

    output_path = output_dir / f"{make_sample_slug(sample_path)}_comparison.png"
    figure.savefig(output_path, dpi=150)
    plt.close(figure)

    return output_path


@torch.no_grad()
def run_inference(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    mean, std = load_normalization_stats(args.stats)
    model = load_model(args.checkpoint, device)
    sample_paths = discover_samples(args.test_dir)
    selected_paths = select_samples(sample_paths, args.n_samples, args.seed)

    print("ConvLSTM inference")
    print(f"  Device: {device}")
    print(f"  Checkpoint: {args.checkpoint}")
    print(f"  Test samples available: {len(sample_paths)}")
    print(f"  Samples selected: {len(selected_paths)}")
    print(f"  Output directory: {args.output_dir}")

    metric_rows = []

    for sample_index, sample_path in enumerate(selected_paths, start=1):
        x, target, mask = load_sample(sample_path)
        x = x.to(device)
        target = target.to(device)
        mask = mask.to(device)

        prediction = torch.nan_to_num(
            model(x),
            nan=0.0,
            posinf=0.0,
            neginf=0.0,
        )

        prediction_denorm = denormalize(prediction, mean, std).squeeze(0)
        target_denorm = denormalize(target.unsqueeze(0), mean, std).squeeze(0)
        x_denorm = x.squeeze(0).clone()
        x_denorm[:, :NORMALIZED_CHANNELS] = denormalize(
            x_denorm[:, :NORMALIZED_CHANNELS],
            mean,
            std,
        )

        mae, mse = compute_metrics(prediction_denorm, target_denorm, mask)
        output_path = plot_comparison(
            sample_path=sample_path,
            x_denorm=x_denorm,
            target_denorm=target_denorm,
            prediction_denorm=prediction_denorm,
            output_dir=args.output_dir,
        )

        metric_rows.append((sample_path.name, mae, mse))
        print(
            f"  [{sample_index}/{len(selected_paths)}] {sample_path.name} "
            f"MAE={mae:.6f} MSE={mse:.6f} -> {output_path}"
        )

    if metric_rows:
        average_mae = sum(row[1] for row in metric_rows) / len(metric_rows)
        average_mse = sum(row[2] for row in metric_rows) / len(metric_rows)
        print(f"\nAverage MAE: {average_mae:.6f}")
        print(f"Average MSE: {average_mse:.6f}")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Run ConvLSTM inference and save T1-T4 comparison figures."
    )
    parser.add_argument("--test-dir", type=Path, default=TEST_DATASET_DIR)
    parser.add_argument("--checkpoint", type=Path, default=CHECKPOINT_PATH)
    parser.add_argument("--stats", type=Path, default=NORMALIZATION_STATS_PATH)
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--n-samples", type=int, default=DEFAULT_N_SAMPLES)
    parser.add_argument("--seed", type=int, default=None)
    return parser.parse_args()


def main():
    args = parse_args()
    run_inference(args)


if __name__ == "__main__":
    main()
