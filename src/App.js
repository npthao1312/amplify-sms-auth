import React from "react";
import "./App.css";
import {
  ConfirmSignIn,
  ConfirmSignUp,
  ForgotPassword,
  RequireNewPassword,
  SignIn,
  SignUp,
  VerifyContact,
  withAuthenticator,
} from "aws-amplify-react";

function App() {
  return <div className="App"></div>;
}

const signUpConfig = {
  header: "Create an Account",
  hideAllDefaults: true,
  defaultCountryCode: "1",
  signUpFields: [
    {
      label: "Phone number",
      key: "username",
      required: true,
      displayOrder: 1,
      type: "string",
    },
    {
      label: "Password",
      key: "password",
      required: true,
      displayOrder: 2,
      type: "password",
    },
  ],
};

export default withAuthenticator(App, {
  includeGreetings: true,
  signUpConfig,
});

// export default withAuthenticator(App, false, [
//   <ConfirmSignIn />,
//   <VerifyContact />,
//   <SignUp />,
//   <ConfirmSignUp />,
//   <ForgotPassword />,
//   <RequireNewPassword />,
// ]);
