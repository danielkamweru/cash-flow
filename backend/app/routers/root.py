from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def root():
    return {
        "name": "Wealth Loop API",
        "version": "0.1.0",
        "docs": {
            "health": "GET /api/health",
            "user": "GET /api/user",
            "snapshot": "GET /api/entities/by-type/PERSONAL/snapshot",
            "providers": "GET /api/providers",
        },
    }
