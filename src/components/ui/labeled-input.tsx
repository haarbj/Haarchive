import type { InputHTMLAttributes } from "react";
import { fieldClass, labelClass } from "@/lib/form-styles";

type LabeledInputProps = {
  id: string;
  label: string;
  className?: string;
  wrapperClassName?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className">;

// The label+input pair repeated for every plain numeric or text field across
// the calculators (age, weight, resting HR, finish time...) -- same two
// form-styles.ts classes and the same wrapping <div> every time, only the
// id/label/width/input attributes changing. `className` is a width override
// on the <input> only (e.g. "w-20"), applied before fieldClass to match the
// call-site order every calculator already used by hand. `wrapperClassName`
// covers the handful of call sites whose outer <div> also carries a flex
// layout hint (e.g. "min-w-0") rather than being bare.
export function LabeledInput({ id, label, className, wrapperClassName, ...inputProps }: LabeledInputProps) {
  return (
    <div className={wrapperClassName}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input id={id} className={`${className ?? ""} ${fieldClass}`.trim()} {...inputProps} />
    </div>
  );
}
