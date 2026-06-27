'use strict';

jest.mock('../src/config/prisma', () => ({ __esModule: true, default: prismaMock }));
jest.mock('../src/services/blockService', () => ({
  __esModule: true,
  getBlockedIds: jest.fn(),
  getBlockerIds: jest.fn(),
}));

function modelStub() {
  return {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    upsert: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
  };
}

const prismaMock = {
  user: modelStub(),
  privateConversation: modelStub(),
  privateMessage: modelStub(),
  message: modelStub(),
  $transaction: jest.fn(async (cb) => cb(prismaMock)),
};

const {
  getBlockedIds,
  getBlockerIds,
} = require('../src/services/blockService');

const {
  PrivateConversationAccessError,
  getPrivateHistory,
  listPrivateConversations,
  sendPrivateMessage,
} = require('../src/services/privateMessagingService');

describe('privateMessagingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getBlockedIds.mockResolvedValue(new Set());
    getBlockerIds.mockResolvedValue(new Set());
    prismaMock.user.findUnique.mockImplementation(async ({ where }) => {
      if (where.id === 'user-a') {
        return {
          id: 'user-a',
          isBanned: false,
          username: 'Sender',
          discordUsername: null,
          discordDisplayName: null,
        };
      }
      if (where.id === 'user-b') {
        return {
          id: 'user-b',
          isBanned: false,
          username: 'Receiver',
          discordUsername: null,
          discordDisplayName: null,
        };
      }
      return null;
    });
    prismaMock.privateConversation.findFirst.mockResolvedValue(null);
    prismaMock.privateConversation.upsert.mockResolvedValue({
      id: 'conv-1',
      userAId: 'user-a',
      userBId: 'user-b',
    });
    prismaMock.privateConversation.update.mockResolvedValue({});
    prismaMock.privateMessage.create.mockResolvedValue({
      id: 'pm-1',
      conversationId: 'conv-1',
      senderId: 'user-a',
      content: 'meet at whitespring?',
      createdAt: new Date('2026-06-25T15:10:00.000Z'),
    });
    prismaMock.privateMessage.findMany.mockResolvedValue([]);
  });

  it('rejects blocked private messages with a generic error', async () => {
    getBlockerIds.mockResolvedValue(new Set(['user-b']));

    await expect(sendPrivateMessage('user-a', 'user-b', 'hello'))
      .rejects.toMatchObject({
        name: 'PrivateMessageUnavailableError',
        message: 'Message unavailable.',
      });

    expect(prismaMock.privateMessage.create).not.toHaveBeenCalled();
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });

  it('returns history only for conversation participants', async () => {
    prismaMock.privateConversation.findFirst.mockImplementation(async ({ where }) => {
      const isParticipant = where?.OR?.some((entry) =>
        entry.userAId === 'user-a' || entry.userBId === 'user-a',
      );
      if (!isParticipant) return null;
      return {
        id: 'conv-1',
        userAId: 'user-a',
        userBId: 'user-b',
        userALastReadAt: null,
        userBLastReadAt: null,
        lastMessageAt: new Date('2026-06-25T15:10:00.000Z'),
        createdAt: new Date('2026-06-25T15:00:00.000Z'),
        userA: { id: 'user-a', username: 'Sender', discordUsername: null, discordDisplayName: null },
        userB: { id: 'user-b', username: 'Receiver', discordUsername: null, discordDisplayName: null },
      };
    });
    prismaMock.privateMessage.findMany.mockResolvedValue([
      {
        id: 'pm-1',
        conversationId: 'conv-1',
        senderId: 'user-a',
        content: 'meet at whitespring?',
        createdAt: new Date('2026-06-25T15:10:00.000Z'),
        sender: { username: 'Sender', discordUsername: null, discordDisplayName: null },
      },
    ]);

    await expect(getPrivateHistory('user-z', 'conv-1'))
      .rejects.toBeInstanceOf(PrivateConversationAccessError);

    const history = await getPrivateHistory('user-a', 'conv-1');
    expect(history).toEqual([
      {
        id: 'pm-1',
        conversationId: 'conv-1',
        senderId: 'user-a',
        senderName: 'Sender',
        recipientId: 'user-b',
        content: 'meet at whitespring?',
        createdAt: '2026-06-25T15:10:00.000Z',
      },
    ]);
  });

  it('includes lastMessageSenderId in private conversation summaries', async () => {
    prismaMock.privateConversation.findMany.mockResolvedValue([
      {
        id: 'conv-1',
        userAId: 'user-a',
        userBId: 'user-b',
        userALastReadAt: null,
        userBLastReadAt: null,
        lastMessageAt: new Date('2026-06-25T15:10:00.000Z'),
        createdAt: new Date('2026-06-25T15:00:00.000Z'),
        userA: { id: 'user-a', username: 'Sender', discordUsername: null, discordDisplayName: null },
        userB: { id: 'user-b', username: 'Receiver', discordUsername: null, discordDisplayName: null },
        messages: [
          {
            content: 'meet at whitespring?',
            createdAt: new Date('2026-06-25T15:10:00.000Z'),
            senderId: 'user-a',
          },
        ],
      },
      {
        id: 'conv-2',
        userAId: 'user-a',
        userBId: 'user-c',
        userALastReadAt: null,
        userBLastReadAt: null,
        lastMessageAt: null,
        createdAt: new Date('2026-06-25T15:20:00.000Z'),
        userA: { id: 'user-a', username: 'Sender', discordUsername: null, discordDisplayName: null },
        userB: { id: 'user-c', username: 'ReceiverTwo', discordUsername: null, discordDisplayName: null },
        messages: [],
      },
    ]);
    prismaMock.privateMessage.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    const conversations = await listPrivateConversations('user-a');

    expect(conversations).toEqual([
      {
        conversationId: 'conv-1',
        otherUserId: 'user-b',
        otherDisplayName: 'Receiver',
        lastMessagePreview: 'meet at whitespring?',
        lastMessageSenderId: 'user-a',
        lastMessageAt: '2026-06-25T15:10:00.000Z',
        unreadCount: 1,
      },
      {
        conversationId: 'conv-2',
        otherUserId: 'user-c',
        otherDisplayName: 'ReceiverTwo',
        lastMessagePreview: '',
        lastMessageSenderId: null,
        lastMessageAt: '2026-06-25T15:20:00.000Z',
        unreadCount: 0,
      },
    ]);
  });

  it('stores private messages separately from public channel messages', async () => {
    const result = await sendPrivateMessage('user-a', 'user-b', 'meet at whitespring?');

    expect(prismaMock.privateConversation.upsert).toHaveBeenCalled();
    expect(prismaMock.privateMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        conversationId: 'conv-1',
        senderId: 'user-a',
        content: 'meet at whitespring?',
      }),
    }));
    expect(prismaMock.message.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'pm-1',
      conversationId: 'conv-1',
      senderId: 'user-a',
      senderName: 'Sender',
      recipientId: 'user-b',
      content: 'meet at whitespring?',
    });
  });
});
