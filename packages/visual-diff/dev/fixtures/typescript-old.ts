interface User {
  id: number;
  name: string;
  email: string;
}

class UserService {
  private users: User[] = [];

  async getUser(id: number): Promise<User | undefined> {
    return this.users.find(user => user.id === id);
  }

  async createUser(name: string, email: string): Promise<User> {
    const user: User = {
      id: this.users.length + 1,
      name,
      email
    };
    this.users.push(user);
    return user;
  }
}

export { UserService };
