from sqlalchemy import create_engine, inspect
from app.config import settings

engine = create_engine(settings.DATABASE_URL)
inspector = inspect(engine)
columns = inspector.get_columns('knowledge_tags')
for column in columns:
    print(f"Column: {column['name']}, Type: {column['type']}, Nullable: {column['nullable']}")
