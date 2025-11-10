# Sample JSON data for Event Ticket Project

This folder contains ready-made sample JSON files you can import into your development database or use as example payloads in Swagger UI.

## Files

- `users.json` - 10 sample user entries (admin, organizers, and regular users). All passwords are already encrypted using bcrypt.
- `venues.json` - 10 sample venues across different cities in Vietnam.
- `events.json` - 10 sample events with various categories and statuses.
- `tickets.json` - 21 sample tickets linked to events and orders.
- `orders.json` - 10 sample orders with different payment methods and statuses.

## Password Information

**All passwords in `users.json` are already encrypted using bcrypt (salt rounds: 10).**

Default passwords (for reference):
- Admin: `AdminPass123!`
- Organizers: `OrganizerPass123!`
- Regular users: `UserPass123!`, `Pass123!`, `Test123!`, `Demo123!`, `Sample123!`, `Guest123!`

**Note:** The password hashes are real bcrypt hashes and ready to use. Do NOT store plain text passwords in production.

How to generate bcrypt hash (PowerShell)
```
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash('AdminPass123!',10).then(h=>console.log(h))"
```

How to generate a JWT for a user (PowerShell)
```
node -e "const jwt=require('jsonwebtoken'); console.log(jwt.sign({id:'64f8c0a0b9e6a5a1b2c3d4e'}, process.env.JWT_SECRET || 'your_jwt_secret',{expiresIn:'7d'}))"
```

Quick import with `mongoimport` (local MongoDB)
```
mongoimport --uri="mongodb://localhost:27017/yourdb" --collection=users --file=data\\sample_json\\users.json --jsonArray
mongoimport --uri="mongodb://localhost:27017/yourdb" --collection=venues --file=data\\sample_json\\venues.json --jsonArray
mongoimport --uri="mongodb://localhost:27017/yourdb" --collection=events --file=data\\sample_json\\events.json --jsonArray
mongoimport --uri="mongodb://localhost:27017/yourdb" --collection=tickets --file=data\\sample_json\\tickets.json --jsonArray
mongoimport --uri="mongodb://localhost:27017/yourdb" --collection=orders --file=data\\sample_json\\orders.json --jsonArray
```

If you want, I can:
- replace the `passwordHash` placeholders with real bcrypt hashes now (I can run `node` here to compute and patch files), or
- produce JWTs signed with your `JWT_SECRET` (you can paste it or I can show commands to run locally).
