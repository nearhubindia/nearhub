const mockDb = {
  select: jest.fn(),
  update: jest.fn(),
  insert: jest.fn(),
};

jest.mock('../../data/db', () => ({
  db: mockDb,
}));

import { upsertCompletedTransaction } from '../../features/subscriptions/services/transaction-records';

function createSelectChain(rows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const where = jest.fn().mockReturnValue({ limit });
  const from = jest.fn().mockReturnValue({ where });
  return { from, where, limit };
}

function createInsertChain() {
  const values = jest.fn().mockResolvedValue(undefined);
  const insert = jest.fn().mockReturnValue({ values });
  return { insert, values };
}

describe('upsertCompletedTransaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the real subscriptions row id when mapping a transaction', async () => {
    const firstSelect = createSelectChain([{ id: 'subscriptions-row-123' }]);
    const secondSelect = createSelectChain([]);
    const insertChain = createInsertChain();

    mockDb.select
      .mockImplementationOnce(() => firstSelect)
      .mockImplementationOnce(() => secondSelect);
    mockDb.insert.mockImplementation(() => insertChain);

    await upsertCompletedTransaction({
      subscriptionId: 'user-subscription-999',
      userId: 'seller-1',
      amount: 499.5,
      paymentId: 'pay_abc',
      orderId: 'order_xyz',
      razorpayData: { source: 'test' },
    });

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'subscriptions-row-123',
        sellerId: 'seller-1',
        amount: '499.50',
        paymentStatus: 'completed',
        paymentId: 'pay_abc',
        orderId: 'order_xyz',
      })
    );
  });

  it('falls back to null when no matching subscriptions row exists', async () => {
    const firstSelect = createSelectChain([]);
    const secondSelect = createSelectChain([]);
    const insertChain = createInsertChain();

    mockDb.select
      .mockImplementationOnce(() => firstSelect)
      .mockImplementationOnce(() => secondSelect);
    mockDb.insert.mockImplementation(() => insertChain);

    await upsertCompletedTransaction({
      subscriptionId: 'user-subscription-unknown',
      userId: 'seller-2',
      amount: 120,
      paymentId: 'pay_def',
      orderId: 'order_def',
    });

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: null,
        sellerId: 'seller-2',
        amount: '120.00',
        paymentStatus: 'completed',
        paymentId: 'pay_def',
        orderId: 'order_def',
      })
    );
  });
});
