import torch
import torch.nn as nn


class ConvLSTMCell(nn.Module):
    """Single ConvLSTM cell preserving spatial dimensions."""

    def __init__(self, input_channels, hidden_channels, kernel_size=3):
        super().__init__()

        if kernel_size % 2 == 0:
            raise ValueError("kernel_size must be odd to preserve spatial dimensions")

        padding = kernel_size // 2
        self.input_channels = input_channels
        self.hidden_channels = hidden_channels

        self.gates = nn.Conv2d(
            input_channels + hidden_channels,
            4 * hidden_channels,
            kernel_size=kernel_size,
            padding=padding,
        )

    def init_hidden(self, batch_size, spatial_size, device=None, dtype=None):
        height, width = spatial_size
        hidden_shape = (batch_size, self.hidden_channels, height, width)

        h = torch.zeros(hidden_shape, device=device, dtype=dtype)
        c = torch.zeros(hidden_shape, device=device, dtype=dtype)

        return h, c

    def forward(self, x, state):
        # x: (B, C_in, H, W), h/c: (B, C_hidden, H, W)
        h_prev, c_prev = state
        combined = torch.cat([x, h_prev], dim=1)
        gates = self.gates(combined)

        input_gate, forget_gate, output_gate, candidate = torch.chunk(gates, 4, dim=1)

        input_gate = torch.sigmoid(input_gate)
        forget_gate = torch.sigmoid(forget_gate)
        output_gate = torch.sigmoid(output_gate)
        candidate = torch.tanh(candidate)

        c_next = forget_gate * c_prev + input_gate * candidate
        h_next = output_gate * torch.tanh(c_next)

        return h_next, c_next


class ConvLSTM(nn.Module):
    """Future-frame predictor for T1,T2,T3 -> T4 satellite tensors."""

    def __init__(
        self,
        input_channels=10,
        output_channels=9,
        feature_channels=64,
        hidden_channels=64,
        kernel_size=3,
    ):
        super().__init__()

        self.input_channels = input_channels
        self.output_channels = output_channels
        self.feature_channels = feature_channels
        self.hidden_channels = hidden_channels

        self.encoder = nn.Sequential(
            nn.Conv2d(
                input_channels,
                feature_channels,
                kernel_size=kernel_size,
                padding=kernel_size // 2,
            ),
            nn.ReLU(inplace=True),
            nn.Conv2d(
                feature_channels,
                feature_channels,
                kernel_size=kernel_size,
                padding=kernel_size // 2,
            ),
            nn.ReLU(inplace=True),
        )

        self.temporal = ConvLSTMCell(
            input_channels=feature_channels,
            hidden_channels=hidden_channels,
            kernel_size=kernel_size,
        )

        self.prediction_head = nn.Sequential(
            nn.Conv2d(
                hidden_channels,
                feature_channels,
                kernel_size=kernel_size,
                padding=kernel_size // 2,
            ),
            nn.ReLU(inplace=True),
            nn.Conv2d(
                feature_channels,
                output_channels,
                kernel_size=1,
                padding=0,
            ),
        )

    def forward(self, x):
        # x: (B, T=3, C=10, H, W)
        if x.ndim != 5:
            raise ValueError(f"Expected input shape (B, T, C, H, W), got {x.shape}")

        batch_size, sequence_length, channels, height, width = x.shape

        if channels != self.input_channels:
            raise ValueError(
                f"Expected {self.input_channels} input channels, got {channels}"
            )

        h, c = self.temporal.init_hidden(
            batch_size=batch_size,
            spatial_size=(height, width),
            device=x.device,
            dtype=x.dtype,
        )

        for time_index in range(sequence_length):
            # frame: (B, 10, H, W), features: (B, feature_channels, H, W)
            frame = x[:, time_index]
            features = self.encoder(frame)
            h, c = self.temporal(features, (h, c))

        # prediction: (B, 9, H, W)
        return self.prediction_head(h)
