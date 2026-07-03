"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, Check, X } from "lucide-react";

type PasswordFieldProps = {

  label?: string;

  value: string;

  onChange: (value: string) => void;

  placeholder?: string;

  showStrength?: boolean;

};

export default function PasswordField({

  label = "Password",

  value,

  onChange,

  placeholder = "Enter password",

  showStrength = true,

}: PasswordFieldProps) {

  const [show,setShow] =
    useState(false);

  const rules =
    useMemo(()=>{

      return{

        length:
          value.length >= 8,

        uppercase:
          /[A-Z]/.test(value),

        number:
          /[0-9]/.test(value),

        special:
          /[^A-Za-z0-9]/.test(value),

      };

    },[value]);

  const score =
    Object.values(rules)
      .filter(Boolean)
      .length;

  const strength =
    score <=1
      ? "Weak"
      : score===2
      ? "Fair"
      : score===3
      ? "Good"
      : "Strong";

  return(

    <div className="space-y-3">

      <label
        className="
          text-sm
          font-semibold
          text-gray-700
        "
      >

        {label}

      </label>

     <div
  className="
    flex
    items-center
    rounded-2xl
    border
    border-gray-300
    bg-white
    px-4
    py-4
    transition
    focus-within:border-orange-500
    focus-within:ring-2
    focus-within:ring-orange-200
  "
>

  <div className="mr-3 text-gray-400">

    🔒

  </div>

  <input

    type={
      show
        ? "text"
        : "password"
    }

    value={value}

    onChange={(e)=>

      onChange(
        e.target.value
      )

    }

    placeholder={placeholder}

    className="
      flex-1
      outline-none
      bg-transparent
    "

  />

  <button

    type="button"

    onClick={()=>

      setShow(!show)

    }

    className="text-gray-400"

  >

    {

      show

      ? <EyeOff size={20}/>

      : <Eye size={20}/>

    }

  </button>

</div>

      {

        showStrength && (

          <>

            <div
              className="
                h-2
                rounded-full
                bg-gray-200
                overflow-hidden
              "
            >

              <div

                className={`
                  h-full
                  transition-all
                  ${
                    score===1
                    ? "bg-red-500 w-1/4"
                    : score===2
                    ? "bg-yellow-500 w-2/4"
                    : score===3
                    ? "bg-orange-500 w-3/4"
                    : "bg-green-500 w-full"
                  }
                `}

              />

            </div>

            <p
              className="
                text-sm
                font-medium
                text-gray-600
              "
            >

              Password Strength:

              {" "}

              {strength}

            </p>

            <div className="grid gap-2 text-sm">

              <Rule
                ok={rules.length}
                text="Minimum 8 characters"
              />

              <Rule
                ok={rules.uppercase}
                text="One uppercase letter"
              />

              <Rule
                ok={rules.number}
                text="One number"
              />

              <Rule
                ok={rules.special}
                text="One special character"
              />

            </div>

          </>

        )

      }

    </div>

  );

}

function Rule({

  ok,

  text,

}:{

  ok:boolean;

  text:string;

}){

  return(

    <div className="flex items-center gap-2">

      {

        ok

        ? <Check
            size={16}
            className="text-green-600"
          />

        : <X
            size={16}
            className="text-red-500"
          />

      }

      <span>

        {text}

      </span>

    </div>

  );

}