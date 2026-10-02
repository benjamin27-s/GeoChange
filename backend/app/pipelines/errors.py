class PipelineError(RuntimeError):
    """Base error for live acquisition pipeline failures."""

    status_code = 500


class EarthEngineUnavailableError(PipelineError):
    status_code = 503


class ImageryNotFoundError(PipelineError):
    status_code = 404


class PreprocessingError(PipelineError):
    status_code = 422


class InferenceError(PipelineError):
    status_code = 500


class TensorValidationError(PipelineError):
    status_code = 422
