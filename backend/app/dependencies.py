from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app import database, models, schemas, config, auth_utils

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token")

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """获取当前用户，支持学生、教师、家长三种身份"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, config.settings.SECRET_KEY, algorithms=[config.settings.ALGORITHM])
        user_id: str = payload.get("sub")
        user_type: str = payload.get("user_type", "student")  # 默认为student以保持向后兼容
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # 根据用户类型查询不同的表
    if user_type == "student":
        user = db.query(models.Student).filter(models.Student.student_id == user_id).first()
    elif user_type == "teacher":
        user = db.query(models.Teacher).filter(models.Teacher.id == int(user_id)).first()
    elif user_type == "parent":
        user = db.query(models.Parent).filter(models.Parent.id == int(user_id)).first()
    else:
        raise credentials_exception
    
    if user is None:
        raise credentials_exception
    
    # 返回用户对象和类型
    return {"user": user, "user_type": user_type}
