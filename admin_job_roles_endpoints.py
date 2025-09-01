# Missing endpoints to add to admin.py before the existing job-roles endpoints

@router.get("/job-roles")
async def get_admin_job_roles(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get all job roles for admin"""
    job_roles = db.query(JobRole).all()
    return [
        {
            "id": jr.id,
            "title": jr.title,
            "description": jr.description,
            "traits_json": jr.traits_json,
            "config_json": jr.config_json,
            "created_at": jr.created_at.isoformat() if jr.created_at else None
        } for jr in job_roles
    ]

@router.post("/job-roles")
async def create_admin_job_role(
    job_role_data: dict,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Create a new job role (admin only)"""
    import uuid
    from datetime import datetime
    
    # Create new job role
    db_job_role = JobRole(
        id=str(uuid.uuid4()),
        title=job_role_data.get("title"),
        description=job_role_data.get("description"),
        traits_json=job_role_data.get("traits_json", {}),
        config_json=job_role_data.get("config_json", {}),
        created_at=datetime.utcnow()
    )
    
    db.add(db_job_role)
    db.commit()
    db.refresh(db_job_role)
    
    return {
        "id": db_job_role.id,
        "title": db_job_role.title,
        "description": db_job_role.description,
        "traits_json": db_job_role.traits_json,
        "config_json": db_job_role.config_json,
        "created_at": db_job_role.created_at.isoformat()
    }