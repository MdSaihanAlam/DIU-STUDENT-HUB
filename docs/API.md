# API reference — `/api/v1`

All responses are JSON: `{ ok: true, data }` or `{ ok: false, error: { message, details? } }`.
List endpoints accept `page` and `limit` and return `{ items, page, limit, total, pages, hasMore }`.

**Auth:** the session is an HttpOnly cookie set by `/auth/login` or `/auth/register`. Every non-GET request needs the `X-CSRF-Token` header (get the token from `GET /auth/csrf`). 🔒 = signed-in member, 🛡 = moderator or admin, 👑 = admin only.

## Health & public
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | DB status (503 if the DB is down) |
| GET | `/public/highlights` | Landing page stats, featured research, events, stories, official announcements |
| GET | `/public/search?q=` | Approved resources and public communities |
| GET | `/public/departments` | Department list (id, code, name) |
| GET | `/files/avatars/:file` | Profile photos (public) |
| GET | `/files/{images,housing,attachments}/:file` 🔒 | Post images, listing photos, attachments |

## Auth
| Method | Path | Body |
| --- | --- | --- |
| GET | `/auth/csrf` | — |
| POST | `/auth/register` | `name, email, password, affiliation, acceptTerms` |
| POST | `/auth/login` | `email, password` |
| POST | `/auth/logout` | — |
| GET | `/auth/me` 🔒 | — |
| POST | `/auth/forgot-password` | `email` (always 200) |
| POST | `/auth/reset-password` | `token, password` |
| POST | `/auth/verify-email` | `token` |
| POST | `/auth/resend-verification` 🔒 | — |
| POST | `/auth/change-password` 🔒 | `currentPassword, newPassword` |

## Users, connections, blocking 🔒
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/users?q&department&affiliation` | People directory (public fields only) |
| GET | `/users/suggested` | Suggestions |
| PATCH | `/users/me` | Profile fields, `onboarded` |
| PATCH | `/users/me/settings` | `privacy`, `notificationPrefs` |
| POST / DELETE | `/users/me/avatar` | multipart `avatar` (≤3 MB) |
| GET | `/users/me/blocked` | |
| POST | `/users/me/delete-request` | Deactivate & schedule deletion |
| GET | `/users/me/connections` | `connections, incoming, outgoing, mentorships` |
| POST | `/users/connections/:id/respond` | `accept: boolean` |
| DELETE | `/users/connections/:id` | Remove / withdraw |
| GET | `/users/:id` | Profile respecting visibility + `relationship` |
| GET | `/users/:id/content` | Resources, research (and own housing) |
| POST | `/users/:id/connect` | `kind: connection|mentorship, message` |
| POST / DELETE | `/users/:id/block` | Block / unblock |

## Posts 🔒
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/posts?filter=latest|relevant|department|communities|following&q&hashtag&type&author&community` | Feed |
| GET | `/posts/trending` | Hashtags and active discussions (14 days) |
| POST | `/posts` | multipart: `type, content, community?, pollOptions?` + up to 4 `files` |
| GET / PATCH / DELETE | `/posts/:id` | Edit by author, delete by author or staff |
| POST | `/posts/:id/pin` | Community moderators |
| POST / DELETE | `/posts/:id/react` | `type: like|love|insightful|support|curious` |
| POST | `/posts/:id/vote` | `option` |
| POST | `/posts/:id/share` | `content` |
| GET / POST | `/posts/:id/comments` | `content, parent?` |
| DELETE | `/posts/:id/comments/:commentId` | Author, post author or staff |

## Bookmarks, reports, notifications, search 🔒
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/bookmarks?type=` | Saved items, populated |
| POST | `/bookmarks/toggle` | `targetType, targetId` |
| POST | `/reports` | `targetType, targetId, reason, details?, takedown?` |
| GET | `/notifications?unread=1` | |
| GET | `/notifications/unread-count` | |
| POST | `/notifications/:id/read`, `/notifications/read-all` | |
| GET | `/search?q&type=all|posts|people|resources|research|alumni|events|housing|careers|communities` | |
| GET / POST | `/verification` | Own requests / `requestedAffiliation, evidence` |

## Academic resources 🔒
`GET /resources?q&department&resourceType&semester&courseCode&sort=newest|popular|rating&mine=1` · `GET /resources/facets` · `POST /resources` (multipart `file` ≤15 MB + metadata + `rightsConfirmed`) · `GET /resources/:id` · `GET /resources/:id/download` · `GET /resources/:id/preview` · `POST /resources/:id/rate` (`value 1–5, comment`) · `DELETE /resources/:id`

## Housing 🔒
`GET /housing?q&type&area&minRent&maxRent&gender&availableBy&sort&mine=1` · `POST /housing` (multipart, up to 6 `photos`) · `GET|PATCH|DELETE /housing/:id` · `POST /housing/:id/status` (`active|rented`) · `POST /housing/:id/contact` (`message` → creates a conversation)

## Directory 🔒
`GET /departments` · `GET /departments/:slug` · `GET /faculty?department&q` · `GET /faculty/:id` · `PATCH /faculty/:id` (verified linked faculty only)

## Research 🔒
`GET /research?q&department&domain&status&collab=1&featured=1&verified=0&mine=1&contributor` · `GET /research/domains` · `POST /research` · `GET|PATCH|DELETE /research/:id` · `POST /research/:id/follow` · `POST /research/:id/updates` · `POST /research/:id/files` · `POST /research/:id/collaborate`

## Alumni 🔒
`GET /alumni?q&department&year&industry&employer&role&mentorship=1` · `GET /alumni/facets` · `GET /alumni/stories` · `GET|PUT /alumni/me` · `GET /alumni/:id`

## Careers & events 🔒
`GET /careers?q&type&mode&verified=1&sort&include=expired&mine=1` · `POST /careers` (verified members) · `GET|PATCH|DELETE /careers/:id`
`GET /events?q&category&official=0|1&from&to&past=1&mine=1&department` · `POST /events` · `GET|PUT|DELETE /events/:id` · `GET /events/:id/ics`

## Communities 🔒
`GET /communities?q&type&department&mine=1` · `POST /communities` · `GET|PATCH /communities/:slug` · `POST /communities/:slug/join|leave` · `GET /communities/:slug/members?status=pending` · `POST /communities/:slug/members/:userId` (`approve|remove|promote|demote`)

## Messaging 🔒
`GET /conversations` · `GET /conversations/unread-count` · `POST /conversations` (`userId, message, context?`) · `GET|POST /conversations/:id/messages` · `POST /conversations/:id/accept|decline`

## Admin 🛡
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/admin/stats` | |
| GET | `/admin/users?q&role&status` | |
| PATCH | `/admin/users/:id/role` 👑 | `role` |
| POST | `/admin/users/:id/suspend` / `restore` | `reason` |
| POST | `/admin/users/:id/process-deletion` 👑 | Anonymise a deletion request |
| GET / POST | `/admin/verifications`, `/admin/verifications/:id` | `decision, note` |
| GET / POST | `/admin/reports`, `/admin/reports/:id` | `action: dismiss|remove_content|suspend_user, note` |
| GET / POST | `/admin/queue/:type`, `/admin/queue/:type/:id` | type: `resources|research|careers|events` |
| GET | `/admin/featured` | |
| POST | `/admin/feature/:type/:id` | type: `research|story` |
| GET | `/admin/audit` 👑 | |
| POST / PUT / DELETE | `/admin/departments[/:id]` 👑 | |
| POST / PUT | `/admin/faculty[/:id]` · DELETE 👑 | |
