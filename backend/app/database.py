import ssl
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import DATABASE_URL, DB_USE_SSL

# Neon 等雲端需 SSL；本地 Postgres 可設 DB_USE_SSL=false 關閉
_connect_args: dict = {}
if DB_USE_SSL:
    _ssl_ctx = ssl.create_default_context()
    _ssl_ctx.check_hostname = True
    _ssl_ctx.verify_mode = ssl.CERT_REQUIRED
    _connect_args["ssl"] = _ssl_ctx

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args=_connect_args,
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Add last_lat/last_lng to drones if missing (e.g. existing DBs before this feature)
        await conn.execute(text("ALTER TABLE drones ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION"))
        await conn.execute(text("ALTER TABLE drones ADD COLUMN IF NOT EXISTS last_lng DOUBLE PRECISION"))


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
