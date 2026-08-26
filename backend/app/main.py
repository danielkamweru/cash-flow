from __future__ import annotations

import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import SessionLocal, init_db
from app.routers import actions, api, auth, automation, business, callbacks, coach, loop, resources
from app.routers.root import router as root_router
from app.seed import seed


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    from app.automation.scheduler import catch_up, start_scheduler

    start_scheduler()
    try:
        catch_up()
    except Exception:  # noqa: BLE001
        pass  # rule evaluation must never stop the API from booting
    yield
    from app.automation.scheduler import stop_scheduler

    stop_scheduler()


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(title="Wealth Loop API", version="0.1.0", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex or None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(root_router)
    application.include_router(auth.router)
    application.include_router(api.router)
    application.include_router(loop.router)
    application.include_router(callbacks.router)
    application.include_router(automation.router)
    application.include_router(coach.router)
    application.include_router(resources.router)
    application.include_router(actions.router)
    application.include_router(business.router)
    return application


app = create_app()


def main() -> None:
    if "--seed" in sys.argv:
        init_db()
        db = SessionLocal()
        try:
            seed(db)
        finally:
            db.close()
        return

    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=False,
    )


if __name__ == "__main__":
    main()
