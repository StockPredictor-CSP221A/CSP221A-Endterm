from pydantic import BaseModel


class NewsItem(BaseModel):
    title: str
    publisher: str | None
    url: str
    published_at: str | None
    thumbnail: str | None = None
