const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Department = require('../src/models/Department');

describe('Authentication & Authorization (RBAC)', () => {
  let employeeUser, managerUser, adminUser, department;
  let employeeToken, adminToken;

  beforeEach(async () => {
    department = await Department.create({
      name: 'Engineering',
      costCenter: 'ENG-001',
    });

    const passwordHash = await User.hashPassword('Password123!');

    employeeUser = await User.create({
      name: 'Alex Employee',
      email: 'alex@spendwise.local',
      passwordHash,
      role: 'employee',
      departmentId: department._id,
    });

    managerUser = await User.create({
      name: 'Marcus Manager',
      email: 'marcus@spendwise.local',
      passwordHash,
      role: 'manager',
      departmentId: department._id,
    });

    adminUser = await User.create({
      name: 'Sarah Admin',
      email: 'admin@spendwise.local',
      passwordHash,
      role: 'admin',
      departmentId: department._id,
    });

    // Login employee
    const empLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'alex@spendwise.local',
      password: 'Password123!',
    });
    employeeToken = empLogin.body.token;

    // Login admin
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@spendwise.local',
      password: 'Password123!',
    });
    adminToken = adminLogin.body.token;
  });

  it('rejects unauthenticated requests to protected endpoints', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('authenticates valid credentials, sets HttpOnly cookie and returns JWT token', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'alex@spendwise.local',
      password: 'Password123!',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('alex@spendwise.local');

    // Verify cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/token=/);
    expect(cookies[0]).toMatch(/HttpOnly/i);
  });

  it('rejects invalid password with 401 Unauthorized', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'alex@spendwise.local',
      password: 'WrongPassword!',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('enforces RBAC: prevents employee from accessing admin-only routes', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('allows admin to access admin-only routes', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns current user profile on /auth/me', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('alex@spendwise.local');
    expect(res.body.data.role).toBe('employee');
  });
});
