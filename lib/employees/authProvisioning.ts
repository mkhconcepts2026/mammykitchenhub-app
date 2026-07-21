import { adminClient } from "@/lib/supabase/admin";
import {
  generateEmployeeEmail,
  generateUsername,
} from "./emailGenerator";

export async function generateUniqueLogin(
  firstName: string,
  lastName: string
) {
  const baseUsername = generateUsername(
    firstName,
    lastName
  );

  let username = baseUsername;
  let counter = 1;

  while (true) {
    const email = generateEmployeeEmail(
      username
    );

    const { data } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!data) {
      return {
        username,
        email,
      };
    }

    username = `${baseUsername}${counter}`;
    counter++;
  }
}