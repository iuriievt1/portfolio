import type { SignInInput } from "@bfbs/common-sdk";
import { useRef, useState } from "react";
import { Keyboard, type TextInput } from "react-native";

/** Credentials, password visibility and submission for the sign-in form. */
export function useSignInForm({
  isSubmitting,
  onSubmit,
}: {
  isSubmitting: boolean;
  onSubmit: (credentials: SignInInput) => void;
}) {
  const passwordRef = useRef<TextInput>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordHidden, setIsPasswordHidden] = useState(true);

  const submit = () => {
    if (!isSubmitting) {
      Keyboard.dismiss();
      onSubmit({ password, username });
    }
  };

  return {
    focusPassword: () => passwordRef.current?.focus(),
    isPasswordHidden,
    password,
    passwordRef,
    setPassword,
    setUsername,
    submit,
    togglePasswordVisibility: () => setIsPasswordHidden(!isPasswordHidden),
    username,
  };
}
