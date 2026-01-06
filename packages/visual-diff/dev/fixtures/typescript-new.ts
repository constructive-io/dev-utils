interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
  isActive: boolean;
}

type UserCreateInput = Pick<User, 'name' | 'email'>;

class UserService {
  private users: Map<number, User> = new Map();
  private nextId = 1;

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(input: UserCreateInput): Promise<User> {
    const user: User = {
      id: this.nextId++,
      name: input.name,
      email: input.email,
      createdAt: new Date(),
      isActive: true
    };
    this.users.set(user.id, user);
    return user;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }
}

export { UserService, User, UserCreateInput };
