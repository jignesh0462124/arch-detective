"""
Insecure config module.
WARNING: Intentionally vulnerable for ThreatLens scanner testing.
"""
import os

# CWE-798: Hardcoded credentials throughout
DATABASE_URL = "postgresql://admin:Password123!@prod-db.internal:5432/app"
REDIS_URL = "redis://:redis_secret_pass@prod-redis.internal:6379"

AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
AWS_DEFAULT_REGION = "us-east-1"

STRIPE_SECRET_KEY = "sk_live_4eC39HqLyjWDarjtT1zdp7dc"
SENDGRID_API_KEY = "SG.hardcoded_sendgrid_key_for_email_sending"
TWILIO_AUTH_TOKEN = "hardcoded_twilio_token_abc123"

# CWE-16: Configuration — debug/verbose mode on in production
DEBUG = True
TESTING = True
LOG_LEVEL = "DEBUG"
DISPLAY_ERRORS = True

# CWE-319: Cleartext transmission
ALLOW_HTTP = True          # Should be False; force HTTPS
SECURE_COOKIES = False     # Should be True
SESSION_COOKIE_HTTPONLY = False
SESSION_COOKIE_SECURE = False
CSRF_ENABLED = False       # Disabled entirely

# CWE-330: Weak random seed for session
import random
random.seed(42)
SESSION_SECRET = str(random.random())

# Weak TLS config
SSL_MIN_VERSION = "TLSv1"  # TLS 1.0 deprecated — should use TLS 1.2+
VERIFY_SSL = False
