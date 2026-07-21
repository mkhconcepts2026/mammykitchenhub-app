"use client";

type EmployeeCredentials = {
  employeeNumber: string;
  fullName: string;
  username: string;
  loginId: string;
  temporaryPassword: string;
};

interface EmployeeCredentialsModalProps {
  open: boolean;
  credentials: EmployeeCredentials | null;
  onClose: () => void;
  profileId?: string;
onPasswordReset?: (
  newPassword: string
) => void;
}

export default function EmployeeCredentialsModal({

  open,

  credentials,

  onClose,

  profileId,

  onPasswordReset,

}: EmployeeCredentialsModalProps) {

async function resetTemporaryPassword() {

  if (!profileId) return;

  const response = await fetch(
    "/api/admin/employees/reset-password",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        profileId,
      }),
    }
  );

  const result = await response.json();

  if (!result.success) {

    alert(result.message);

    return;

  }

  onPasswordReset?.(
    result.temporaryPassword
  );

  alert(
    "Temporary password has been regenerated."
  );

}

  if (!open || !credentials) return null;

const employee = credentials;

  function copyCredentials() {
    navigator.clipboard.writeText(`MKH Employee Login

Employee Number:
${employee.employeeNumber}

Employee Name:
${employee.fullName}

Application Login:
${employee.loginId}

Temporary Password:
${employee.temporaryPassword}

Please change your password immediately after your first login.
`);

    alert("✅ Credentials copied successfully.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">

      <div className="w-full max-w-2xl rounded-3xl bg-white p-8 shadow-2xl">

        <h2 className="mb-2 text-3xl font-bold text-green-600">
          ✅ Employee Created Successfully
        </h2>

        <p className="mb-8 text-gray-500">
          Please copy these credentials and send them securely to the employee.
        </p>

        <div className="space-y-5">

          <div>
            <label className="text-sm font-semibold text-gray-500">
              Employee Number
            </label>

            <div className="mt-1 rounded-xl bg-gray-100 p-3">
              {credentials.employeeNumber}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-500">
              Employee Name
            </label>

            <div className="mt-1 rounded-xl bg-gray-100 p-3">
              {credentials.fullName}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-500">
              Application Login
            </label>

            <div className="mt-1 rounded-xl bg-gray-100 p-3">
              {credentials.loginId}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-500">
              Temporary Password
            </label>

            <div className="mt-1 rounded-xl bg-orange-50 p-3 font-bold text-orange-700">
              {credentials.temporaryPassword}
            </div>
          </div>

        </div>

        <div className="mt-8 flex justify-end gap-4">

<button

  onClick={resetTemporaryPassword}

  className="rounded-xl border border-orange-500 px-5 py-3 font-semibold text-orange-600 hover:bg-orange-50"

>

  🔄 Reset Password

</button>

          <button
            onClick={copyCredentials}
            className="rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-600"
          >
            📋 Copy Credentials
          </button>

          <button
            onClick={onClose}
            className="rounded-xl border px-6 py-3 font-semibold"
          >
            Done
          </button>

        </div>

      </div>

    </div>
  );
}