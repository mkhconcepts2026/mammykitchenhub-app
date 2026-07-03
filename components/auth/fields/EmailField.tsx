"use client";

import TextField from "./TextField";
import { Mail } from "lucide-react";

type Props = {

  value: string;

  onChange: (
    value: string
  ) => void;

};

export default function EmailField({

  value,

  onChange,

}: Props) {

  return (

   <TextField

  label="Email Address"

  icon={<Mail size={20}/>}

  type="email"

  placeholder="john@example.com"

  value={value}

  onChange={(e)=>

    onChange(e.target.value)

  }

/>

  );

}