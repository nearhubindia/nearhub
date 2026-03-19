import { parseArgs, runBackfill } from '../../scripts/backfill-transactions';

describe('backfill-transactions script', () => {
  it('parses --dry-run flag', () => {
    expect(parseArgs(['--dry-run']).dryRun).toBe(true);
    expect(parseArgs([]).dryRun).toBe(false);
  });

  it('returns zero inserts in dry-run mode', async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: 2 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            subscription_id: 'sub_1',
            user_id: 'user_1',
            payment_id: 'pay_1',
            order_id: 'ord_1',
            amount: '99.00',
          },
        ],
      });

    const result = await runBackfill({
      dryRun: true,
      executor: { execute },
    });

    expect(result).toEqual({
      candidateCount: 2,
      insertedCount: 0,
    });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('inserts rows when not dry-run', async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            subscription_id: 'sub_2',
            user_id: 'user_2',
            payment_id: 'pay_2',
            order_id: 'ord_2',
            amount: '149.00',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'tx_1',
            subscription_id: 'sub_2',
            payment_id: 'pay_2',
            amount: '149.00',
          },
        ],
      });

    const result = await runBackfill({
      dryRun: false,
      executor: { execute },
    });

    expect(result).toEqual({
      candidateCount: 1,
      insertedCount: 1,
    });
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it('short-circuits when there are no candidates', async () => {
    const execute = jest.fn().mockResolvedValueOnce({ rows: [{ count: 0 }] });

    const result = await runBackfill({
      dryRun: false,
      executor: { execute },
    });

    expect(result).toEqual({
      candidateCount: 0,
      insertedCount: 0,
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
