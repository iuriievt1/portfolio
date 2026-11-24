import { createStore, useStore } from "zustand";

type SignInRequestState = {
  isRequested: boolean;
};

/** Lets an error action hand the reader back to the sign-in form from anywhere. */
const signInRequestStore = createStore<SignInRequestState>(() => ({
  isRequested: false,
}));

/** Asks the gate to drop the session and show the form again. */
export function requestSignIn() {
  signInRequestStore.setState({ isRequested: true });
}

/** Clears the request once the gate has acted on it. */
export function consumeSignInRequest() {
  signInRequestStore.setState({ isRequested: false });
}

/** Whether a sign-in request is waiting for the gate. */
export function useIsSignInRequested() {
  return useStore(signInRequestStore).isRequested;
}
