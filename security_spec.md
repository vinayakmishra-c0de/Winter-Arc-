# Security Specification — Winter Arc Command Center

## 1. Data Invariants
1. Every document under `/users/{userId}/...` belongs strictly to `{userId}` (`request.auth.uid == userId`), and `incoming().ownerId == request.auth.uid`.
2. Unauthenticated users and other authenticated users have zero read/write/list access to any `/users/{userId}` document.
3. All document IDs (`userId`, `topicId`, `logId`, `mockId`, `noteId`, `settingId`) must match `^[a-zA-Z0-9_\-]+$` and stay `<= 128` characters.
4. `ownerId` and `createdAt` are immutable once created (`incoming().ownerId == existing().ownerId`, `incoming().createdAt == existing().createdAt`).
5. `createdAt` and `updatedAt` must equal `request.time` on creation/update.
6. All strings have explicit `.size()` upper bounds, and all arrays (`synergy`, `links`, `tags`) are strictly size-bounded (`<= 3` or `<= 20`).
7. Updates use action-based `affectedKeys().hasOnly(...)` allowlists so shadow/ghost fields are rejected.
8. Only verified-email accounts (`request.auth.token.email_verified == true`) may perform writes.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Cross-User Read/List**: User B attempts `get` or `list` on `/users/userA/topics`.
2. **Owner Spoofing on Create**: User A creates `/users/userA/topics/t1` with `ownerId: "userB"`.
3. **Shadow Field Injection**: User A creates `/users/userA/topics/t1` with extra field `isAdmin: true`.
4. **Unverified Email Write**: Authenticated user with `email_verified: false` writes to `/users/userA/topics/t1`.
5. **ID Poisoning**: User A writes to `/users/userA/topics/` with a 500-character ID or invalid characters (`../admin`).
6. **Denial-of-Wallet Large String**: User A creates a topic with `name` of 10,000 characters (`> 260`).
7. **Unbounded Links Array**: User A updates a topic with `links` array of 50 items (`> 20`).
8. **Immutable Field Tampering**: User A updates `createdAt` or `ownerId` on an existing topic.
9. **Client Timestamp Forgery**: User A creates a focus log with `createdAt` set to a past client timestamp instead of `request.time`.
10. **Invalid Exam Enum**: User A creates a mock test with `exam: "CAT"` instead of `IITM | IPMAT | CUET`.
11. **Out-of-Range Daily Target**: User A writes `dailyTargetHours: 24` (`> 6.5`) in `/users/userA/settings/preferences`.
12. **Vault Note Content Overflow**: User A creates a vault note with `content` exceeding 4,000 characters.
