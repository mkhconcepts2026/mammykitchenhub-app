"use client";

import Image from "next/image";
import { Plus, Minus } from "lucide-react";

export interface MenuItemType {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
}

interface MenuItemProps {
  item: MenuItemType;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}

export function MenuItem({
  item,
  quantity,
  onAdd,
  onRemove,
}: MenuItemProps) {

  return (

    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">

      <div className="flex gap-4">

        <div className="relative w-24 h-24 flex-shrink-0">

          <Image
            src={item.image}
            alt={item.name}
            fill
            sizes="96px"
            className="rounded-xl object-cover"
          />

        </div>

        <div className="flex-1">

          <h3 className="font-semibold text-lg mb-1">

            {item.name}

          </h3>

          <p className="text-gray-500 text-sm mb-3">

            {item.description}

          </p>

          <div className="flex items-center justify-between">

            <p className="font-bold text-orange-500">

              ₦{item.price.toLocaleString()}

            </p>

            {quantity === 0 ? (

              <button
                onClick={onAdd}
                className="
                  bg-orange-500
                  text-white
                  px-4
                  py-2
                  rounded-lg
                  flex
                  items-center
                  gap-2
                "
              >

                <Plus className="w-4 h-4" />

                Add

              </button>

            ) : (

              <div className="flex items-center gap-3">

                <button
                  onClick={onRemove}
                  className="
                    w-8
                    h-8
                    rounded-full
                    bg-orange-100
                    flex
                    items-center
                    justify-center
                  "
                >
                  <Minus className="w-4 h-4" />
                </button>

                <span className="font-bold">

                  {quantity}

                </span>

                <button
                  onClick={onAdd}
                  className="
                    w-8
                    h-8
                    rounded-full
                    bg-orange-500
                    text-white
                    flex
                    items-center
                    justify-center
                  "
                >
                  <Plus className="w-4 h-4" />
                </button>

              </div>

            )}

          </div>

        </div>

      </div>

    </div>

  );
}