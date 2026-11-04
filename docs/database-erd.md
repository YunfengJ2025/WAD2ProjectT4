# Database logical ER diagram

Based on the Mongoose schemas in `server/models`, inspected on 4 November 2026. This describes the current code-defined structure; a running database was not inspected.

## Reading the diagram

- `||` = exactly one, `o|` = zero or one, `o{` = zero or many.
- `PK` marks MongoDB's physical `_id`. `UK` marks a unique application identifier or unique field. `FK` marks a logical reference, not a MongoDB foreign-key constraint.
- Every collection except `Counter` has an ObjectId `_id` (omitted below except where it is the only identifier). `Counter._id` is a string. Mongoose's version field is omitted.
- Numeric application identifiers use unique sparse indexes and counters. They are not the physical primary keys, and schemas allow them to be absent during creation.
- Optional references are labelled `optional`. Relationships express intended links; MongoDB does not enforce that referenced documents exist.

```mermaid
erDiagram
    User ||..o{ Plant : "owns (ownerId)"
    User ||..o{ CareRequest : "creates (ownerId)"
    User o|..o{ CareVisit : "sits (sitterId, optional)"
    CareRequest ||..o{ CareVisit : "schedules (requestId)"
    CareVisit o|..o| CareRequest : "makeupForVisitId (optional)"
    CareVisit ||..o{ RequestItem : "contains (visitId)"
    Plant ||..o{ RequestItem : "included in (plantId)"
    RequestItem ||..o{ PhotoProof : "has (requestItemId)"
    CareVisit ||..o{ PhotoProof : "documents (visitId)"
    RequestItem ||..o| HealthCheck : "has (requestItemId unique)"
    CareVisit ||..o{ HealthCheck : "checked during (visitId)"
    Plant ||..o{ HealthCheck : "assessed (plantId)"
    User ||..o{ HealthCheck : "notified owner (ownerId)"
    User ||..o{ Post : "writes (creatorId)"
    User ||..o{ Like : "likes (creatorId)"
    Post ||..o{ Like : "receives (postId)"
    User ||..o{ Review : "authors (creatorId)"
    User ||..o{ Review : "receives (receiverId)"
    CareVisit o|..o{ Review : "VISIT target (optional)"
    Post o|..o{ Review : "POST target (optional)"
    Review o|..o{ Review : "REVIEW parent (optional)"
    User o|..o{ TokenTransaction : "sends (senderId, optional)"
    User o|..o{ TokenTransaction : "receives (receiverId, optional)"
    CareVisit o|..o{ TokenTransaction : "visitId (optional)"
    CareRequest o|..o{ TokenTransaction : "requestId (optional)"
    User ||..o{ Notification : "receives (userId)"
    CareVisit o|..o{ Notification : "visitId (optional)"
    CareRequest o|..o{ Notification : "requestId (optional)"

    User {
        number userId UK
        string userName UK
        string email UK
        string passwordHash
        string photoUrl
        string photoPublicId
        string bio
        string postalCode
        string block
        string unitNumber
        number lat
        number lng
        number tokenBalance
        object_array tokenReservations "embedded requestId and amount"
        boolean accountPublic
        boolean hideFromLeaderboard
        string userRole
        object_array badges "embedded badge details"
        date createdAt
    }
    Plant {
        number plantId UK
        number ownerId FK
        string plantName
        string photoUrl
        string photoPublicId
        object wateringInfo "embedded frequencyDays amountMl notes"
        string plantLocation
        boolean rainExposed
        boolean isOutdoor
        boolean weatherAdjustmentEnabled
        date lastWateredAt
        date createdAt
        date updatedAt
    }
    CareRequest {
        number requestId UK
        number ownerId FK
        number makeupForVisitId FK,UK "optional sparse unique"
        date startDate
        date endDate
        string note
        string waterSource
        boolean healthCheck
        number tokenReward
        string status
        date createdAt
    }
    CareVisit {
        number visitId UK
        number sitterId FK "optional"
        number requestId FK
        date visitDate
        string status
        date doneAt
        string weatherAlert
        boolean corridorCared
        date weatherCheckedAt
        boolean weatherSkip
    }
    RequestItem {
        number requestItemId UK
        number visitId FK
        number plantId FK
        string action
        number amountToWater
        string careInstructions
        string_array completedSteps
        string status
        date originalDueAt
        date dueAt
        string adjustmentType
        string adjustmentReason
        date weatherCheckedAt
    }
    PhotoProof {
        number photoProofId UK
        number requestItemId FK
        number visitId FK
        string photoUrl
        string photoPublicId
        date takenAt
    }
    HealthCheck {
        number healthCheckId UK
        number requestItemId FK,UK
        number visitId FK
        number plantId FK
        number ownerId FK
        string status
        string provider
        boolean isHealthy
        number healthProbability
        object_array issues "embedded diagnosis and treatment"
        string error
        date ownerSeenAt
        date createdAt
    }
    Post {
        number postId UK
        number creatorId FK
        string title
        string content
        string_array postImages
        number likedCount
    }
    Like {
        ObjectId _id PK
        number creatorId FK "unique together with postId"
        number postId FK
        date likedAt
    }
    Review {
        number reviewId UK
        string type "VISIT or POST or REVIEW"
        number visitId FK "conditional target"
        number postId FK "conditional target"
        number parentReviewId FK "conditional target"
        number creatorId FK
        number receiverId FK
        number rating "required for VISIT"
        string comment
        date createdAt
        date lastChangeAt
    }
    TokenTransaction {
        number transactionId UK
        number visitId FK "optional"
        number requestId FK "optional"
        string reason
        number senderId FK "optional"
        number receiverId FK "optional"
        number amount
        string type "SYSTEM_GIFT or CARE or PENALTY"
        boolean balanceApplied
        date createdAt
    }
    Notification {
        ObjectId _id PK
        number userId FK
        string type
        string message
        number visitId FK "optional"
        number requestId FK "optional"
        date readAt
        date createdAt
    }
    Counter {
        string _id PK "sequence name e.g. userId"
        number seq
    }
```

## Embedded structures

These are stored inside their parent document, not as separate collections.

| Parent field | Embedded fields |
| --- | --- |
| `User.tokenReservations[]` | `requestId` (logical reference to `CareRequest.requestId`), `amount`; Mongoose also generates a subdocument `_id` |
| `User.badges[]` | `id`, `name`, `description`, `icon`, `unlockedAt`; Mongoose also generates a subdocument `_id` |
| `Plant.wateringInfo` | `frequencyDays`, `amountMl`, `notes`; no subdocument `_id` |
| `HealthCheck.issues[]` | `name`, `probability`, `description`, `cause`, `commonNames[]`, `treatment.prevention[]`, `treatment.biological[]`, `treatment.chemical[]`; no subdocument `_id` |

## Important constraints and interpretation

- `RequestItem` links a plant to a particular visit. The request-to-plant relationship runs through `CareRequest → CareVisit → RequestItem → Plant`; there is no direct `requestId` on `RequestItem`.
- `Like` resolves the many-to-many relationship between users and posts. `(creatorId, postId)` is a unique compound index, while `_id` remains the physical primary key.
- `Review` stores visit feedback, post comments, and replies. Validation requires exactly one of `visitId`, `postId`, or `parentReviewId`, matching `type`. `(creatorId, visitId)` is unique only when `visitId` is numeric. Visit reviews require a rating from 1 to 5.
- `HealthCheck.requestItemId` is unique, so an item has at most one health check. `PhotoProof.requestItemId` is not unique: the schema permits multiple proofs per item.
- `CareRequest.makeupForVisitId` has a unique sparse index: a missed or expired visit can be referenced by at most one make-up request.
- A visit can have multiple token transactions overall, but a partial unique index allows at most one transaction of type `CARE` per `visitId`. System gifts have no sender; penalties have no receiver, as validated in the transaction creation code.
- `TokenTransaction.visitId` declares `ref: "Visit"`, although the actual model is `CareVisit`. The diagram shows the intended logical link. Numeric references target application IDs; Mongoose `ref` does not by itself enforce these links or make default `_id` population work for them.
- `Counter` is infrastructure for generating numeric identifiers. It has no document-level foreign-key relationship to the other collections.
- Explicit collection names are `User`, `Plant`, `CareRequest`, `CareVisit`, `RequestItem`, `PhotoProof`, `HealthCheck`, `Notification`, and `Counter`. `Post`, `Like`, `Review`, and `TokenTransaction` use Mongoose's default collection naming.

## Schema sources

All 13 models: [User](../server/models/userModel.js), [Plant](../server/models/plantModel.js), [CareRequest](../server/models/careRequestModel.js), [CareVisit](../server/models/careVisitModel.js), [RequestItem](../server/models/requestItemModel.js), [PhotoProof](../server/models/photoProofModel.js), [HealthCheck](../server/models/healthCheckModel.js), [Post](../server/models/postModel.js), [Like](../server/models/likeModel.js), [Review](../server/models/reviewModel.js), [TokenTransaction](../server/models/tokenModel.js), [Notification](../server/models/notificationModel.js), [Counter](../server/models/counterModel.js).
