"""日志工具"""
import logging
from config.settings import Settings

def setup_logger(name: str, log_file=None, level=None):
    """设置日志器"""
    logger = logging.getLogger(name)
    logger.setLevel(level or Settings.LOG_LEVEL)
    
    formatter = logging.Formatter(Settings.LOG_FORMAT, datefmt=Settings.LOG_DATE_FORMAT)
    
    # 控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # 文件处理器
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger

# 默认日志器
app_logger = setup_logger("app", Settings.APP_LOG_FILE)
error_logger = setup_logger("error", Settings.ERROR_LOG_FILE, "ERROR")
