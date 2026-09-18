declare global {
  namespace Express {
    interface Request {
      user: {
        id: string
        email: string
        name: string
        role: 'ADMIN' | 'NORMAL_VIEWER' | 'VIP_VIEWER'
        mustChangePassword: boolean
      }
    }
  }
}

export {}
