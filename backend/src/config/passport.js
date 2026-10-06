import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // We will handle the database lookup/creation in the callback route itself
        // to keep things simple and stateless, so we just pass the profile along.
        return done(null, profile);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

export default passport;
