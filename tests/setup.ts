import { beforeAll, afterAll, vi } from "vitest"

// Mock Prisma client
vi.mock("@/lib/prisma", () => ({
  prisma: {
    ruleConfig: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    event: {
      findUnique: vi.fn(),
    },
    rotativo: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    block: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    userSeasonBalance: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    waitingListEntry: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((operations) => Promise.all(operations)),
  },
}))

beforeAll(() => {
  // Setup global mocks
})

afterAll(() => {
  // Cleanup
  vi.restoreAllMocks()
})
