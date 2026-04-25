export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      franquicias: {
        Row: {
          id: string;
          nombre: string;
          direccion: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          nombre: string;
          direccion?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          nombre?: string;
          direccion?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      perfiles: {
        Row: {
          id: string;
          rol: "admin_global" | "admin_franquicia" | "socio";
          franquicia_id: string | null;
          nombre: string;
          email: string;
          created_at: string | null;
        };
        Insert: {
          id: string;
          rol: "admin_global" | "admin_franquicia" | "socio";
          franquicia_id?: string | null;
          nombre: string;
          email: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          rol?: "admin_global" | "admin_franquicia" | "socio";
          franquicia_id?: string | null;
          nombre?: string;
          email?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "perfiles_franquicia_id_fkey";
            columns: ["franquicia_id"];
            isOneToOne: false;
            referencedRelation: "franquicias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "perfiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      instructores: {
        Row: {
          id: string;
          franquicia_id: string | null;
          nombre: string;
          estado: string | null;
          especialidad: string | null;
        };
        Insert: {
          id?: string;
          franquicia_id?: string | null;
          nombre: string;
          estado?: string | null;
          especialidad?: string | null;
        };
        Update: {
          id?: string;
          franquicia_id?: string | null;
          nombre?: string;
          estado?: string | null;
          especialidad?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "instructores_franquicia_id_fkey";
            columns: ["franquicia_id"];
            isOneToOne: false;
            referencedRelation: "franquicias";
            referencedColumns: ["id"];
          },
        ];
      };
      formas_pago: {
        Row: {
          id: string;
          franquicia_id: string;
          nombre: string;
          orden: number;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          franquicia_id: string;
          nombre: string;
          orden?: number;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          franquicia_id?: string;
          nombre?: string;
          orden?: number;
          activo?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "formas_pago_franquicia_id_fkey";
            columns: ["franquicia_id"];
            isOneToOne: false;
            referencedRelation: "franquicias";
            referencedColumns: ["id"];
          },
        ];
      };
      conceptos_caja: {
        Row: {
          id: string;
          franquicia_id: string;
          tipo: "ingreso" | "egreso";
          concepto: string;
          descripcion: string;
          orden: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          franquicia_id: string;
          tipo: "ingreso" | "egreso";
          concepto: string;
          descripcion: string;
          orden?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          franquicia_id?: string;
          tipo?: "ingreso" | "egreso";
          concepto?: string;
          descripcion?: string;
          orden?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conceptos_caja_franquicia_id_fkey";
            columns: ["franquicia_id"];
            isOneToOne: false;
            referencedRelation: "franquicias";
            referencedColumns: ["id"];
          },
        ];
      };
      plantillas_clases: {
        Row: {
          id: string;
          franquicia_id: string;
          nombre: string;
          instructor_id: string;
          horario: string;
          cupo_maximo: number | null;
          orden: number;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          franquicia_id: string;
          nombre: string;
          instructor_id: string;
          horario: string;
          cupo_maximo?: number | null;
          orden?: number;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          franquicia_id?: string;
          nombre?: string;
          instructor_id?: string;
          horario?: string;
          cupo_maximo?: number | null;
          orden?: number;
          activo?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plantillas_clases_franquicia_id_fkey";
            columns: ["franquicia_id"];
            isOneToOne: false;
            referencedRelation: "franquicias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plantillas_clases_instructor_id_fkey";
            columns: ["instructor_id"];
            isOneToOne: false;
            referencedRelation: "instructores";
            referencedColumns: ["id"];
          },
        ];
      };
      planes: {
        Row: {
          id: string;
          franquicia_id: string | null;
          nombre: string;
          precio: number;
          version: string | null;
          estado: string | null;
        };
        Insert: {
          id?: string;
          franquicia_id?: string | null;
          nombre: string;
          precio: number;
          version?: string | null;
          estado?: string | null;
        };
        Update: {
          id?: string;
          franquicia_id?: string | null;
          nombre?: string;
          precio?: number;
          version?: string | null;
          estado?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "planes_franquicia_id_fkey";
            columns: ["franquicia_id"];
            isOneToOne: false;
            referencedRelation: "franquicias";
            referencedColumns: ["id"];
          },
        ];
      };
      socios: {
        Row: {
          id: string;
          perfil_id: string | null;
          franquicia_id: string | null;
          plan_id: string | null;
          telefono: string | null;
          mes_ultimo_aumento: string;
          estado: string | null;
        };
        Insert: {
          id?: string;
          perfil_id?: string | null;
          franquicia_id?: string | null;
          plan_id?: string | null;
          telefono?: string | null;
          mes_ultimo_aumento?: string;
          estado?: string | null;
        };
        Update: {
          id?: string;
          perfil_id?: string | null;
          franquicia_id?: string | null;
          plan_id?: string | null;
          telefono?: string | null;
          mes_ultimo_aumento?: string;
          estado?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "socios_perfil_id_fkey";
            columns: ["perfil_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "socios_franquicia_id_fkey";
            columns: ["franquicia_id"];
            isOneToOne: false;
            referencedRelation: "franquicias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "socios_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "planes";
            referencedColumns: ["id"];
          },
        ];
      };
      pagos: {
        Row: {
          id: string;
          franquicia_id: string | null;
          socio_id: string | null;
          monto: number;
          nombre_plan_historico: string;
          mes_correspondiente: string;
          fecha_pago: string | null;
        };
        Insert: {
          id?: string;
          franquicia_id?: string | null;
          socio_id?: string | null;
          monto: number;
          nombre_plan_historico: string;
          mes_correspondiente: string;
          fecha_pago?: string | null;
        };
        Update: {
          id?: string;
          franquicia_id?: string | null;
          socio_id?: string | null;
          monto?: number;
          nombre_plan_historico?: string;
          mes_correspondiente?: string;
          fecha_pago?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pagos_franquicia_id_fkey";
            columns: ["franquicia_id"];
            isOneToOne: false;
            referencedRelation: "franquicias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pagos_socio_id_fkey";
            columns: ["socio_id"];
            isOneToOne: false;
            referencedRelation: "socios";
            referencedColumns: ["id"];
          },
        ];
      };
      clases: {
        Row: {
          id: string;
          franquicia_id: string | null;
          instructor_id: string | null;
          nombre: string;
          fecha_hora: string;
          cupo_maximo: number;
          reservas_actuales: number | null;
        };
        Insert: {
          id?: string;
          franquicia_id?: string | null;
          instructor_id?: string | null;
          nombre: string;
          fecha_hora: string;
          cupo_maximo?: number;
          reservas_actuales?: number | null;
        };
        Update: {
          id?: string;
          franquicia_id?: string | null;
          instructor_id?: string | null;
          nombre?: string;
          fecha_hora?: string;
          cupo_maximo?: number;
          reservas_actuales?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "clases_franquicia_id_fkey";
            columns: ["franquicia_id"];
            isOneToOne: false;
            referencedRelation: "franquicias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clases_instructor_id_fkey";
            columns: ["instructor_id"];
            isOneToOne: false;
            referencedRelation: "instructores";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Perfil = Database["public"]["Tables"]["perfiles"]["Row"];
export type Socio = Database["public"]["Tables"]["socios"]["Row"];
export type FormaPago = Database["public"]["Tables"]["formas_pago"]["Row"];
export type ConceptoCaja = Database["public"]["Tables"]["conceptos_caja"]["Row"];
export type PlantillaClase = Database["public"]["Tables"]["plantillas_clases"]["Row"];
