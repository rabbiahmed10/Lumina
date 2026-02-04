
export interface User {
  id: string;
  username: string;
  avatar: string;
  fullName: string;
  coverPhoto?: string;
  bio?: string;
  postsCount?: number;
  followersCount?: number;
  followingCount?: number;
  isVerified?: boolean;
  isFollowing?: boolean;
}

export interface Post {
  id: string;
  user: User;
  imageUrl: string;
  caption: string;
  likes: number;
  comments: Comment[];
  timestamp: string;
  isLiked: boolean;
}

export interface Comment {
  id: string;
  username: string;
  text: string;
  timestamp: string;
}

export interface Story {
  id: string;
  user: User;
  imageUrl: string;
  viewed: boolean;
}

export interface FriendRequest {
  id: string;
  user: User;
  timestamp: string;
}