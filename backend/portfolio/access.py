from django.db.models import Q

from .models import ProjectInvite


VISIBLE_INVITE_STATUSES = (
    ProjectInvite.STATUS_INVITED,
    ProjectInvite.STATUS_ACCEPTED,
)


def is_private_job(project):
    return bool(getattr(project, "is_job_posting", False) and (getattr(project, "is_private", False) or getattr(project, "post_privacy", "public") == "private"))


def is_user_invited_to_project(project, user):
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return project.invites.filter(
        contractor=user,
        status__in=VISIBLE_INVITE_STATUSES,
    ).exists()


def can_view_project(project, user):
    if getattr(user, "is_authenticated", False) and project.owner_id == user.id:
        return True
    if getattr(user, "is_authenticated", False) and getattr(user, "is_staff", False):
        return True

    owner_profile = getattr(project.owner, "profile", None)
    if owner_profile and getattr(owner_profile, "is_frozen", False):
        return False

    if is_private_job(project):
        return is_user_invited_to_project(project, user)

    return bool(project.is_public)


def can_access_job_interactions(project, user):
    if not getattr(project, "is_job_posting", False):
        return False
    if getattr(user, "is_authenticated", False) and project.owner_id == user.id:
        return True
    if is_private_job(project):
        return is_user_invited_to_project(project, user)
    return bool(getattr(user, "is_authenticated", False))


def visible_projects_q_for_user(user):
    owner_not_frozen = Q(owner__profile__is_frozen=False) | Q(owner__profile__isnull=True)
    public_visible = Q(
        is_public=True,
        is_private=False,
        post_privacy="public",
    ) & owner_not_frozen

    if user and getattr(user, "is_authenticated", False):
        return (
            Q(owner=user)
            | public_visible
            | (
                Q(
                    invites__contractor=user,
                    invites__status__in=VISIBLE_INVITE_STATUSES,
                )
                & owner_not_frozen
            )
        )
    return public_visible
