const Post = require('../models/Post');

exports.getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('author')
      .populate({
        path: 'comments.author',
        select: 'username photo'
      })
      .populate('likes', 'username photo')
      .sort({ createdAt: -1 });
    res.render('index', { posts, user: req.user });
  } catch (err) {
    console.error('Error getting posts:', err);
    res.status(500).send('Gagal mengambil postingan.');
  }
};

exports.createPost = async (req, res) => {
  try {
    const { title, content } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Judul dan konten harus diisi' });
    }

    const post = new Post({
      title,
      content,
      image,
      author: req.user._id
    });

    await post.save();
    res.redirect('/');
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Gagal membuat postingan' });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post || post.author.toString() !== req.user._id.toString()) {
      return res.status(403).send('Anda tidak memiliki izin untuk menghapus postingan ini.');
    }
    await Post.findByIdAndDelete(req.params.postId);
    res.redirect('/');
  } catch (err) {
    console.error('Error deleting post:', err);
    res.status(500).send('Gagal menghapus postingan');
  }
};

exports.editPostForm = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    res.render('editpost', { post, user: req.user });
  } catch (err) {
    res.send('Gagal memuat form edit');
  }
};

exports.updatePost = async (req, res) => {
  const { title, content } = req.body;
  try {
    const post = await Post.findById(req.params.postId);
    if (!post || post.author.toString() !== req.user._id.toString()) {
      return res.status(403).send('Anda tidak memiliki izin untuk mengedit postingan ini.');
    }
    post.title = title;
    post.content = content;
    await post.save();
    res.redirect('/');
  } catch (err) {
    res.send('Gagal mengupdate postingan');
  }
};

// Like/Unlike toggle
exports.toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const userLikedIndex = post.likes.indexOf(req.user._id);
    
    if (userLikedIndex === -1) {
      // Add like
      post.likes.push(req.user._id);
    } else {
      // Remove like
      post.likes.splice(userLikedIndex, 1);
    }

    await post.save();
    
    // Return updated like count and status
    res.json({ 
      likeCount: post.likes.length,
      isLiked: userLikedIndex === -1
    });
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
};

// Add comment
exports.addComment = async (req, res) => {
  try {
    const { content } = req.body;
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    post.comments.push({
      author: req.user._id,
      content: content
    });

    await post.save();

    // Populate the new comment's author
    const populatedPost = await Post.findById(post._id)
      .populate({
        path: 'comments.author',
        select: 'username photo'
      });

    const newComment = populatedPost.comments[populatedPost.comments.length - 1];

    res.json({ 
      success: true,
      comment: newComment
    });
  } catch (err) {
    console.error('Comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
};

// Delete comment
exports.deleteComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    post.comments.pull({ _id: req.params.commentId });
    await post.save();
    
    res.json({ success: true });
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
};

// Share post
exports.sharePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    post.shareCount += 1;
    await post.save();
    res.json({ shareCount: post.shareCount });
  } catch (err) {
    console.error('Share error:', err);
    res.status(500).json({ error: 'Failed to share post' });
  }
};

// Get single post
exports.getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId)
      .populate('author')
      .populate({
        path: 'comments.author',
        select: 'username photo'
      })
      .populate('likes', 'username photo');

    if (!post) {
      return res.status(404).render('error', { 
        error: 'Post not found',
        user: req.user
      });
    }

    res.render('post', { 
      post,
      user: req.user,
      title: `${post.title} | Petstagram`
    });
  } catch (err) {
    console.error('Error getting post:', err);
    res.status(500).render('error', { 
      error: 'Failed to load post',
      user: req.user
    });
  }
};
