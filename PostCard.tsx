
import React, { useState } from 'react';
import { Post, User } from '../types';
import { ICONS } from '../constants';

interface PostCardProps {
  post: Post;
  onLike: (postId: string) => void;
  onComment: (postId: string, text: string) => void;
  onUserClick: (user: User) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onLike, onComment, onUserClick }) => {
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [newComment, setNewComment] = useState('');

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      onComment(post.id, newComment);
      setNewComment('');
    }
  };

  return (
    <article className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 md:border md:rounded-2xl md:mb-8 overflow-hidden shadow-sm transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => onUserClick(post.user)}>
          <div className="w-10 h-10 rounded-full bg-brand-gradient p-0.5 group-hover:scale-105 transition-transform shadow-md">
            <img src={post.user.avatar} className="w-full h-full rounded-full border-2 border-white dark:border-slate-900 object-cover" />
          </div>
          <span className="font-bold text-sm tracking-tight hover:text-[#006a4e] dark:hover:text-[#f42a41] dark:text-gray-200 transition-colors">{post.user.username}</span>
        </div>
        <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
        </button>
      </div>

      {/* Image */}
      <div className="relative aspect-square md:aspect-auto overflow-hidden bg-gray-50 dark:bg-slate-950">
        <img 
          src={post.imageUrl} 
          alt="Lumina post" 
          className="w-full h-full object-cover select-none"
          onDoubleClick={() => onLike(post.id)}
        />
      </div>

      {/* Actions */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-5">
            <button onClick={() => onLike(post.id)} className={`transition-transform active:scale-125 ${post.isLiked ? 'text-[#f42a41]' : 'text-gray-800 dark:text-gray-200 hover:text-[#006a4e] dark:hover:text-[#f42a41]'}`}>
              <ICONS.Heart className={`w-7 h-7 ${post.isLiked ? 'fill-current' : ''}`} />
            </button>
            <button className="text-gray-800 dark:text-gray-200 hover:text-[#006a4e] dark:hover:text-[#f42a41] transition-colors"><ICONS.Comment className="w-7 h-7" /></button>
            <button className="text-gray-800 dark:text-gray-200 hover:text-[#006a4e] dark:hover:text-[#f42a41] transition-colors rotate-[-15deg]"><ICONS.Share className="w-7 h-7" /></button>
          </div>
          <button className="text-gray-800 dark:text-gray-200 hover:text-[#006a4e] dark:hover:text-[#f42a41] transition-colors"><ICONS.Bookmark className="w-7 h-7" /></button>
        </div>

        {/* Likes */}
        <p className="font-bold text-sm mb-1.5 text-gray-900 dark:text-gray-100 tracking-tight">{post.likes.toLocaleString()} people shone light</p>

        {/* Caption */}
        <p className="text-sm text-gray-800 dark:text-gray-300 leading-relaxed">
          <span className="font-bold mr-2 cursor-pointer hover:underline text-gray-900 dark:text-gray-100" onClick={() => onUserClick(post.user)}>{post.user.username}</span>
          {showFullCaption ? post.caption : `${post.caption.substring(0, 110)}${post.caption.length > 110 ? '...' : ''}`}
          {post.caption.length > 110 && !showFullCaption && (
            <button onClick={() => setShowFullCaption(true)} className="text-[#006a4e] dark:text-[#f42a41] font-bold ml-1.5 hover:underline">more</button>
          )}
        </p>

        {/* Comments Preview */}
        {post.comments.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {post.comments.slice(0, 2).map(comment => (
              <p key={comment.id} className="text-[13px] text-gray-600 dark:text-gray-400">
                <span className="font-bold mr-2 text-gray-900 dark:text-gray-200">{comment.username}</span>
                {comment.text}
              </p>
            ))}
            {post.comments.length > 2 && (
              <button className="text-xs text-gray-400 dark:text-gray-500 font-bold hover:text-[#006a4e] dark:hover:text-[#f42a41] transition-colors mt-1">View all comments</button>
            )}
          </div>
        )}

        <p className="text-gray-400 dark:text-gray-600 text-[9px] uppercase mt-3 tracking-[0.15em] font-bold">{post.timestamp}</p>

        {/* Comment Input */}
        <form onSubmit={handleCommentSubmit} className="mt-4 flex items-center border-t border-gray-50 dark:border-slate-800 pt-3">
          <input
            type="text"
            placeholder="Add a thought..."
            className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600 font-medium dark:text-white"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <button 
            type="submit" 
            disabled={!newComment.trim()}
            className="text-[#006a4e] dark:text-[#f42a41] text-sm font-bold disabled:opacity-30 ml-3 transition-opacity active:scale-95"
          >
            Send
          </button>
        </form>
      </div>
    </article>
  );
};

export default PostCard;
