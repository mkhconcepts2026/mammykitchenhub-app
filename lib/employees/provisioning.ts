import { generateEmployeeNumber } from "./employeeNumber";
import {
  generateEmployeeEmail,
  generateUsername,
} from "./emailGenerator";
import { generateUniqueLogin } from "./authProvisioning";
import { validateEmployee } from "./validation";

export async function prepareEmployee(data: any) {
  validateEmployee(data);

  const employeeNumber =
    await generateEmployeeNumber();

 const {
  username,
  email,
} = await generateUniqueLogin(
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