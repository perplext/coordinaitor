import 'reflect-metadata';
import { DatabaseService } from '../../src/database/database-service';
import { User } from '../../src/database/entities/User';
import { Organization } from '../../src/database/entities/Organization';

describe('Database Connection', () => {
  let db: DatabaseService;

  beforeAll(async () => {
    // Use test database
    process.env.DB_NAME = process.env.DB_NAME || 'orchestrator_test';
    process.env.NODE_ENV = 'test';
    
    db = DatabaseService.getInstance();
    await db.initialize();
  });

  afterAll(async () => {
    await db.close();
  });

  it('should connect to the database', () => {
    const dataSource = db.getDataSource();
    expect(dataSource.isInitialized).toBe(true);
  });

  it('should have all entities registered', () => {
    const dataSource = db.getDataSource();
    const entities = dataSource.entityMetadatas;
    
    const entityNames = entities.map(e => e.name);
    expect(entityNames).toContain('Organization');
    expect(entityNames).toContain('User');
    expect(entityNames).toContain('Role');
    expect(entityNames).toContain('Task');
    expect(entityNames).toContain('Project');
    expect(entityNames).toContain('Agent');
  });

  it('should perform basic CRUD operations', async () => {
    const orgRepo = db.getRepository(Organization);
    const userRepo = db.getRepository(User);

    // Create organization
    const org = await orgRepo.save({
      name: 'Test Org',
      slug: 'test-org-' + Date.now(),
      description: 'Test organization'
    });

    expect(org.id).toBeDefined();
    expect(org.createdAt).toBeDefined();

    // Create user
    const user = await userRepo.save({
      organizationId: org.id,
      email: `test-${Date.now()}@example.com`,
      username: `testuser-${Date.now()}`,
      passwordHash: 'hash',
      firstName: 'Test',
      lastName: 'User'
    });

    expect(user.id).toBeDefined();

    // Read user
    const foundUser = await userRepo.findOne({ where: { id: user.id } });
    expect(foundUser).toBeDefined();
    expect(foundUser?.email).toBe(user.email);

    // Update user
    await userRepo.update(user.id, { firstName: 'Updated' });
    const updatedUser = await userRepo.findOne({ where: { id: user.id } });
    expect(updatedUser?.firstName).toBe('Updated');

    // Delete user and org
    await userRepo.delete(user.id);
    await orgRepo.delete(org.id);

    const deletedUser = await userRepo.findOne({ where: { id: user.id } });
    expect(deletedUser).toBeNull();
  });

  it('should handle transactions', async () => {
    const result = await db.transaction(async (queryRunner) => {
      const orgRepo = queryRunner.manager.getRepository(Organization);
      
      const org = await orgRepo.save({
        name: 'Transaction Test',
        slug: 'transaction-test-' + Date.now()
      });

      // Simulate some work
      expect(org.id).toBeDefined();

      // Return result
      return org;
    });

    expect(result).toBeDefined();
    expect(result.name).toBe('Transaction Test');

    // Clean up
    const orgRepo = db.getRepository(Organization);
    await orgRepo.delete(result.id);
  });

  it('should use custom repositories', async () => {
    // Test UserRepository
    const org = await db.getRepository(Organization).save({
      name: 'Repo Test Org',
      slug: 'repo-test-' + Date.now()
    });

    const user = await db.users.create({
      organizationId: org.id,
      email: `repo-test-${Date.now()}@example.com`,
      username: `repotest-${Date.now()}`,
      passwordHash: 'hash',
      firstName: 'Repo',
      lastName: 'Test'
    });

    const foundByEmail = await db.users.findByEmail(user.email);
    expect(foundByEmail).toBeDefined();
    expect(foundByEmail?.id).toBe(user.id);

    const foundByUsername = await db.users.findByUsername(user.username);
    expect(foundByUsername).toBeDefined();
    expect(foundByUsername?.id).toBe(user.id);

    // Clean up
    await db.users.delete(user.id);
    await db.getRepository(Organization).delete(org.id);
  });
});