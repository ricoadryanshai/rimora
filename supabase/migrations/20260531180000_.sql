CREATE OR REPLACE FUNCTION public.validate_word_replacement_input(
  original_word TEXT,
  replacement_word TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF original_word IS NULL OR replacement_word IS NULL THEN
    RAISE EXCEPTION 'Both original and replacement words are required';
  END IF;

  IF TRIM(original_word) = '' OR TRIM(replacement_word) = '' THEN
    RAISE EXCEPTION 'Words cannot be empty or contain only whitespace';
  END IF;

  IF LENGTH(original_word) > 500 OR LENGTH(replacement_word) > 500 THEN
    RAISE EXCEPTION 'Words cannot exceed 500 characters';
  END IF;

  IF original_word ~ '[<>"]' OR replacement_word ~ '[<>"]' THEN
    RAISE EXCEPTION 'Words cannot contain HTML or script characters';
  END IF;

  RETURN TRUE;
END;
$$;
