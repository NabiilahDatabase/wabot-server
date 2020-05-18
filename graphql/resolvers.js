const posts = [
    { id: 1, data: 'josss' },
    { id: 2, data: 'wahhh' },
    { id: 3, data: 'layyy' },
    { id: 4, data: 'cuyyy' },
    { id: 5, data: 'assss' },
];

const resolvers = {
    Query:{
        // return all posts
        getPosts(parent, args, { pubsub }) {
            pubsub.publish('posts', {posts: posts});
            return posts;
        },
        // return post by args passed, for now it just check for body and 
        // title for the post
        getPost(parent, args) {
          return posts.filter((post) => {
            console.log('query:', args.query);
            const data = post.data.toLowerCase().includes(args.query.toLowerCase());
            return data;
          });
        }
    },

    Mutation:{
        createPost(parent, args, { pubsub }) {
            const id = parseInt(args.id, 10);
            console.log('search id', id);
            const postIndex = posts.findIndex((post)=> post.id === id);
            if (postIndex === -1) {
                posts.push({
                    ...args
                });
                
                pubsub.publish('posts', {posts: posts}); 
                return {...args};
            };
            throw new Error('Post with same id already exist!');
        },
        updatePost(parent, args, { pubsub }){
            const id = parseInt(args.id, 10);
            console.log('update id', id);
            const postIndex = posts.findIndex((post)=> post.id === id);
            if (postIndex !== -1) {
                const post = posts[postIndex];
                const updatedPost = {
                    ...post,
                    ...args
                };
            posts.splice(postIndex, 1, updatedPost);
            pubsub.publish('posts', {posts: posts});
            return updatedPost;
            }
            throw new Error('Post does not exist!');
        },
        deletePost(parent, args, { pubsub }){
            const id = parseInt(args.id, 10);
            console.log('del id', id);
            const isPostExists = posts.findIndex((post)=> post.id === id);
            if(isPostExists === -1) {
                throw new Error('Post does not exist!');
            }
            //splice will return the index of the removed items from the array object
            const [post] = posts.splice(isPostExists, 1);
            // return post;
            pubsub.publish('posts', {posts: posts});
            return post;
        }
    },

    Subscription:{
        posts:{
            subscribe(parent, args, {pubsub}){
                return pubsub.asyncIterator('posts');
            }
        }
    },
};

module.exports = resolvers;
