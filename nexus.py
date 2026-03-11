from __future__ import annotations

from typing import Dict, List, Optional
import json
import os

from models import AgentProfile, AuditEvent, Branch, Commit, Discussion, DiscussionMessage, GovernancePolicy, PullRequest, Repository, Review, to_dict


class AutonomousForge:
    def __init__(self, policy: Optional[GovernancePolicy] = None):
        self.policy = policy or GovernancePolicy()
        self.repositories: List[Repository] = []
        self.agents: List[AgentProfile] = []
        self.global_feed: List[AuditEvent] = []

    def register_agent(self, profile: AgentProfile) -> None:
        self.agents.append(profile)
        self._record_global_event(
            AuditEvent(
                event_type="agent.registered",
                actor=profile.name,
                summary=f"Registered agent {profile.name} as {profile.role}",
            )
        )

    def create_repository(
        self,
        name: str,
        description: str,
        creator: str,
        primary_language: str,
        technology_stack: List[str],
    ) -> Repository:
        repo = Repository(
            name=name,
            description=description,
            owner=creator,
            primary_language=primary_language,
            technology_stack=list(technology_stack),
        )
        repo.audit_log.append(
            AuditEvent(
                event_type="repo.created",
                actor=creator,
                summary=f"Created repository {name}",
                metadata={"primary_language": primary_language},
            )
        )
        repo.commit_history.append(Commit(author=creator, message="Bootstrap repository"))
        self.repositories.append(repo)
        self._record_global_event(repo.audit_log[-1])
        return repo

    def update_repository_profile(
        self,
        repo: Repository,
        actor: str,
        description: Optional[str] = None,
        primary_language: Optional[str] = None,
        stack_updates: Optional[List[str]] = None,
    ) -> None:
        if description:
            repo.description = description
        if primary_language:
            repo.primary_language = primary_language
        if stack_updates:
            for item in stack_updates:
                if item not in repo.technology_stack:
                    repo.technology_stack.append(item)
        event = AuditEvent(
            event_type="repo.updated",
            actor=actor,
            summary=f"Updated repository profile for {repo.name}",
        )
        repo.audit_log.append(event)
        self._record_global_event(event)

    def request_delete_repository(self, repo: Repository, actor: str, reason: str) -> bool:
        if not self.policy.allow_agent_repo_deletion:
            return False
        if self.policy.require_reason_for_delete and not reason.strip():
            return False
        repo.status = "deleted"
        event = AuditEvent(
            event_type="repo.deleted",
            actor=actor,
            summary=f"Deleted repository {repo.name}",
            metadata={"reason": reason},
        )
        repo.audit_log.append(event)
        self._record_global_event(event)
        return True

    def create_branch(self, repo: Repository, branch_name: str, source_branch: str = "main") -> Branch:
        source = repo.branches.get(source_branch)
        files = dict(source.files) if source else {}
        branch = Branch(name=branch_name, files=files)
        repo.branches[branch_name] = branch
        return branch

    def commit_to_branch(self, repo: Repository, branch_name: str, commit: Commit) -> None:
        branch = repo.branches.setdefault(branch_name, Branch(name=branch_name))
        branch.files.update(commit.diff)
        branch.commit_ids.append(commit.id)
        event = AuditEvent(
            event_type="branch.committed",
            actor=commit.author,
            summary=f"Committed to {repo.name}:{branch_name}",
            metadata={"commit_id": commit.id, "message": commit.message},
        )
        repo.audit_log.append(event)
        self._record_global_event(event)

    def create_discussion(self, repo: Repository, title: str, author: str, content: str, channel: str) -> Discussion:
        discussion = Discussion(title=title, author=author, channel=channel)
        discussion.messages.append(DiscussionMessage(author=author, text=content))
        repo.discussions.append(discussion)
        event = AuditEvent(
            event_type="discussion.created",
            actor=author,
            summary=f"Opened discussion '{title}' in {repo.name}",
        )
        repo.audit_log.append(event)
        self._record_global_event(event)
        return discussion

    def add_discussion_message(self, repo: Repository, discussion: Discussion, author: str, text: str) -> None:
        discussion.messages.append(DiscussionMessage(author=author, text=text))
        event = AuditEvent(
            event_type="discussion.replied",
            actor=author,
            summary=f"Replied to discussion '{discussion.title}' in {repo.name}",
        )
        repo.audit_log.append(event)
        self._record_global_event(event)

    def publish_social_post(self, repo: Repository, actor: str, text: str) -> None:
        repo.social_posts.append(f"{actor}: {text}")
        event = AuditEvent(
            event_type="social.posted",
            actor=actor,
            summary=f"Published a repo broadcast in {repo.name}",
        )
        repo.audit_log.append(event)
        self._record_global_event(event)

    def create_pull_request(
        self,
        repo: Repository,
        title: str,
        description: str,
        author: str,
        source_branch: str,
        commits: List[Commit],
        target_branch: str = "main",
    ) -> PullRequest:
        pr = PullRequest(
            title=title,
            description=description,
            author=author,
            source_branch=source_branch,
            target_branch=target_branch,
            commits=commits,
        )
        repo.prs.append(pr)
        for commit in commits:
            self.commit_to_branch(repo, source_branch, commit)
        event = AuditEvent(
            event_type="pr.created",
            actor=author,
            summary=f"Opened PR '{title}' in {repo.name}",
            metadata={"pr_id": pr.id},
        )
        repo.audit_log.append(event)
        self._record_global_event(event)
        return pr

    def review_pull_request(self, repo: Repository, pr: PullRequest, reviewer: str, decision: str, comment: str) -> None:
        review = Review(reviewer=reviewer, decision=decision, comment=comment)
        pr.reviews.append(review)
        event = AuditEvent(
            event_type="pr.reviewed",
            actor=reviewer,
            summary=f"Reviewed PR '{pr.title}' with {decision}",
            metadata={"pr_id": pr.id},
        )
        repo.audit_log.append(event)
        self._record_global_event(event)

    def maybe_merge_pr(self, repo: Repository, pr: PullRequest) -> bool:
        if pr.status != "open":
            return False

        approvals = sum(1 for review in pr.reviews if review.decision == "approve")
        rejections = sum(1 for review in pr.reviews if review.decision == "reject")
        if approvals < self.policy.min_approvals_to_merge:
            return False
        if self.policy.reject_blocks_merge and rejections > 0:
            return False
        if approvals <= rejections:
            return False

        target = repo.branches.setdefault(pr.target_branch, Branch(name=pr.target_branch))
        source = repo.branches.get(pr.source_branch, Branch(name=pr.source_branch))
        target.files.update(source.files)
        repo.files.update(target.files)
        for commit in pr.commits:
            repo.commit_history.append(commit)
        pr.status = "merged"
        event = AuditEvent(
            event_type="pr.merged",
            actor="system",
            summary=f"Merged PR '{pr.title}' into {repo.name}",
            metadata={"pr_id": pr.id},
        )
        repo.audit_log.append(event)
        self._record_global_event(event)
        return True

    def close_pull_request(self, repo: Repository, pr: PullRequest, actor: str) -> None:
        pr.status = "closed"
        event = AuditEvent(
            event_type="pr.closed",
            actor=actor,
            summary=f"Closed PR '{pr.title}' in {repo.name}",
        )
        repo.audit_log.append(event)
        self._record_global_event(event)

    def get_repo(self, name: str) -> Optional[Repository]:
        for repo in self.repositories:
            if repo.name == name:
                return repo
        return None

    def summary(self) -> List[Dict[str, object]]:
        result: List[Dict[str, object]] = []
        for repo in self.repositories:
            result.append(
                {
                    "name": repo.name,
                    "status": repo.status,
                    "primary_language": repo.primary_language,
                    "stack": repo.technology_stack,
                    "commits": len(repo.commit_history),
                    "pull_requests": len(repo.prs),
                    "merged_pull_requests": sum(1 for pr in repo.prs if pr.status == "merged"),
                    "discussions": len(repo.discussions),
                    "social_posts": len(repo.social_posts),
                }
            )
        return result

    def export_state(self, file_path: str) -> None:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        payload = {
            "policy": to_dict(self.policy),
            "agents": [to_dict(agent) for agent in self.agents],
            "repositories": [to_dict(repo) for repo in self.repositories],
            "global_feed": [to_dict(event) for event in self.global_feed],
            "summary": self.summary(),
        }
        with open(file_path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)

    def _record_global_event(self, event: AuditEvent) -> None:
        self.global_feed.append(event)