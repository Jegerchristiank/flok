export type ID = string;

export type RSVPStatus = 'yes' | 'no' | 'maybe';

export interface FlokUser {
  id: ID;
  name: string;
  email: string;
  phone: string;
  isParent: boolean;
  children: Array<{ id: ID; name: string; age: number }>;
  friends: ID[];
  friendRequestsIncoming: ID[];
  friendRequestsOutgoing: ID[];
  socials?: {
    website?: string;
    instagram?: string;
    facebook?: string;
    x?: string;
    tiktok?: string;
  };
  createdAt: string;
}

export interface FlokFriend {
  id: ID;
  a: ID;
  b: ID;
  createdAt: string;
}

export interface RSVP {
  status: RSVPStatus;
  by: ID;
  at: string;
  withChildren: ID[];
}

export interface PollOption {
  id: ID;
  text: string;
  votes: ID[];
}

export interface PostPoll {
  question: string;
  options: PollOption[];
  multi?: boolean;
}

export interface PostComment {
  id: ID;
  by: ID;
  text: string;
  at: string;
  likes?: ID[];
}

export interface Post {
  id: ID;
  by: ID;
  type: 'host' | 'guest' | 'poll';
  text: string;
  images: string[];
  pinned: boolean;
  at: string;
  likes?: ID[];
  comments?: PostComment[];
  poll?: PostPoll;
}

export type TempAccounts = {
  [username: string]: { pin: string; createdAt: string; expiresAt: string; userId: ID };
};

export interface FlokEvent {
  id: ID;
  title: string;
  cover?: string;
  description: string;
  address: string;
  datetime: string;
  endtime?: string;
  timezone: string;
  isPublic: boolean;
  hasPassword: boolean;
  password?: string;
  hostId: ID;
  cohosts?: ID[];
  allowGuestPosts: boolean;
  notifyOnHostPost: boolean;
  maxGuests?: number;
  waitlist: boolean;
  autoPromote?: boolean;
  rsvpPolicy: { type: 'deadline' | 'max' | 'both' | 'none'; deadline?: string };
  attendees: { [userId: ID]: RSVP };
  waitlistQueue: ID[];
  posts: Post[];
  chat: Array<{ id: ID; by: ID; text: string; at: string }>;
  tempAccounts: TempAccounts;
  inviteToken: string;
  createdAt: string;
  archivedAt: string | null;
  seriesId?: string;
  seriesIndex?: number;
  seriesTotal?: number;
}

export interface FlokInvite {
  id: ID;
  eventId: ID;
  from: ID;
  to: ID;
  at: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface NotificationItem {
  id: ID;
  text: string;
  at: string;
  read?: boolean;
  type?: string;
  owner?: ID;
  importance?: 'high' | 'low';
}

export interface FlokDB {
  users: { [id: ID]: FlokUser };
  friendships: FlokFriend[];
  events: { [id: ID]: FlokEvent };
  sessions: { [id: ID]: { userId?: ID; temp?: { eventId: ID; username: string } } };
  notifications: NotificationItem[];
  invites: FlokInvite[];
}

