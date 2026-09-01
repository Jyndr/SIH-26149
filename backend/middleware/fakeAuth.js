// Temporary fake auth middleware for Phase 2
// This will be replaced with real JWT auth in Phase 3

const fakeAuth = (req, res, next) => {
  req.user = {
    id: '000000000000000000000000', // Fake ObjectId
    name: 'Test User',
    email: 'test@example.com',
    role: 'INVESTIGATOR'
  };
  next();
};

export default fakeAuth;
