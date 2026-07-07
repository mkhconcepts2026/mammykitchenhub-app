export function validateEmployee(data: any) {
  const required = [
    "firstName",
    "lastName",
    "phone",
    "gender",
    "nationality",
    "address",
    "departmentId",
    "roleId",
    "stateId",
  ];

  for (const field of required) {
    if (!data[field]) {
      throw new Error(`${field} is required.`);
    }
  }

  return true;
}