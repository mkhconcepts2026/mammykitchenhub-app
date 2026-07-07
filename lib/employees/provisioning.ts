import { generateEmployeeNumber } from "./employeeNumber";
import {
  generateEmployeeEmail,
  generateUsername,
} from "./emailGenerator";
import { validateEmployee } from "./validation";

export async function prepareEmployee(data: any) {
  validateEmployee(data);

  const employeeNumber =
    await generateEmployeeNumber();

  const email = generateEmployeeEmail(
    data.firstName,
    data.lastName
  );

  const username = generateUsername(
    data.firstName,
    data.lastName
  );

  return {
    ...data,
    employeeNumber,
    email,
    username,
  };
}