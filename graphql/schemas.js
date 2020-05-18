const typeDefs = `
type Query {
    getPosts: [Post!]!
    getPost(query: String):Post!
}
type Post{
    id: ID!
    data: String!
}
type Mutation{
    updatePost(
      id:ID!
      data: String!
    ): Post!
    deletePost(id: ID!): Post!
    createPost(
      id:ID!
      data:String!
    ): Post!
}
type Subscription {
    posts: [Post!]!
}

`;

module.exports = typeDefs;
