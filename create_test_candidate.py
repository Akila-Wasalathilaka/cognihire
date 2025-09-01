from database import get_db
from models import User, Tenant, CandidateProfile
from routers.auth import get_password_hash
import uuid

db = next(get_db())
tenant = db.query(Tenant).first()

# Create tenant if it doesn't exist
if not tenant:
    tenant = Tenant(
        id=str(uuid.uuid4()),
        name='Default Tenant',
        subdomain='default'
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)

# Create test candidate
test_user = User(
    id=str(uuid.uuid4()),
    tenant_id=tenant.id,
    username='testcandidate',
    email='test@candidate.com',
    password_hash=get_password_hash('password123'),
    role='CANDIDATE',
    is_active=True
)
db.add(test_user)

# Create candidate profile
profile = CandidateProfile(
    user_id=test_user.id,
    full_name='Test Candidate'
)
db.add(profile)

db.commit()
print('Test candidate created: username=testcandidate, password=password123')