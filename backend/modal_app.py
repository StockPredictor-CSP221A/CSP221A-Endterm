import modal

app = modal.App("stock-predictor-api")
hf_cache = modal.Volume.from_name("stock-predictor-hf-cache", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.12")
    .uv_sync(extras=["ml"])
    .env({"HF_HOME": "/cache/huggingface"})
    .add_local_python_source("app")
)


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("stock-predictor-api")],
    volumes={"/cache": hf_cache},
    cpu=2,
    memory=4096,
    timeout=600,
    scaledown_window=60,
)
@modal.asgi_app()
def fastapi_app():
    from app.main import app as web_app

    return web_app
