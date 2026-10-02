import torch
import torch.nn as nn
import torch.nn.functional as F


class ConvBlock(nn.Module):
    def __init__(self, in_channels, out_channels, dropout=0.0):
        super().__init__()

        layers = [
            nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
        ]

        if dropout > 0.0:
            layers.append(nn.Dropout2d(dropout))

        self.block = nn.Sequential(*layers)

    def forward(self, x):
        return self.block(x)


class EncoderBlock(nn.Module):
    def __init__(self, in_channels, out_channels, dropout=0.0):
        super().__init__()
        self.conv = ConvBlock(in_channels, out_channels, dropout=dropout)
        self.pool = nn.MaxPool2d(kernel_size=2, stride=2)

    def forward(self, x):
        features = self.conv(x)
        downsampled = self.pool(features)
        return features, downsampled


class DecoderBlock(nn.Module):
    def __init__(self, in_channels, skip_channels, out_channels, dropout=0.0):
        super().__init__()
        self.up = nn.ConvTranspose2d(
            in_channels,
            out_channels,
            kernel_size=2,
            stride=2,
        )
        self.conv = ConvBlock(
            out_channels + skip_channels,
            out_channels,
            dropout=dropout,
        )

    def forward(self, x, skip):
        x = self.up(x)

        if x.shape[-2:] != skip.shape[-2:]:
            x = F.interpolate(
                x,
                size=skip.shape[-2:],
                mode="bilinear",
                align_corners=False,
            )

        x = torch.cat([x, skip], dim=1)
        return self.conv(x)


class SiameseUNet(nn.Module):
    def __init__(
        self,
        in_channels=10,
        out_channels=1,
        features=(32, 64, 128, 256),
        dropout=0.0,
    ):
        super().__init__()

        if len(features) < 2:
            raise ValueError("features must contain at least two channel sizes")

        self.encoder_blocks = nn.ModuleList()
        current_channels = in_channels

        for feature_channels in features:
            self.encoder_blocks.append(
                EncoderBlock(
                    current_channels,
                    feature_channels,
                    dropout=dropout,
                )
            )
            current_channels = feature_channels

        self.bottleneck = ConvBlock(
            features[-1],
            features[-1] * 2,
            dropout=dropout,
        )

        decoder_channels = list(reversed(features))
        self.decoder_blocks = nn.ModuleList()
        current_channels = features[-1] * 2

        for skip_channels in decoder_channels:
            self.decoder_blocks.append(
                DecoderBlock(
                    current_channels,
                    skip_channels,
                    skip_channels,
                    dropout=dropout,
                )
            )
            current_channels = skip_channels

        self.output_conv = nn.Conv2d(
            features[0],
            out_channels,
            kernel_size=1,
        )

    def encode(self, x):
        skips = []

        for encoder_block in self.encoder_blocks:
            features, x = encoder_block(x)
            skips.append(features)

        bottleneck = self.bottleneck(x)
        return skips, bottleneck

    def forward(self, t1, t2):
        t1_skips, t1_bottleneck = self.encode(t1)
        t2_skips, t2_bottleneck = self.encode(t2)

        x = torch.abs(t1_bottleneck - t2_bottleneck)
        skip_differences = [
            torch.abs(first - second)
            for first, second in zip(t1_skips, t2_skips)
        ]

        for decoder_block, skip in zip(
            self.decoder_blocks,
            reversed(skip_differences),
        ):
            x = decoder_block(x, skip)

        return self.output_conv(x)
