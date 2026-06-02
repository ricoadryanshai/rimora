-- Fix missing INSERT policy for profiles table
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Add comprehensive input validation function
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
  -- Check for null or empty inputs
  IF original_word IS NULL OR replacement_word IS NULL THEN
    RAISE EXCEPTION 'Both original and replacement words are required';
  END IF;
  
  -- Trim and check for empty strings
  IF TRIM(original_word) = '' OR TRIM(replacement_word) = '' THEN
    RAISE EXCEPTION 'Words cannot be empty or contain only whitespace';
  END IF;
  
  -- Check length limits (reasonable limits for words)
  IF LENGTH(original_word) > 500 OR LENGTH(replacement_word) > 500 THEN
    RAISE EXCEPTION 'Words cannot exceed 500 characters';
  END IF;
  
  -- Check for potentially dangerous characters (basic XSS prevention)
  IF original_word ~ '[<>''"]' OR replacement_word ~ '[<>''"]' THEN
    RAISE EXCEPTION 'Words cannot contain HTML or script characters';
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Add validation trigger for word_replacements
CREATE OR REPLACE FUNCTION public.validate_word_replacement_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.validate_word_replacement_input(
    NEW.original_word,
    NEW.replacement_word
  );
  
  -- Sanitize inputs by trimming whitespace
  NEW.original_word := TRIM(NEW.original_word);
  NEW.replacement_word := TRIM(NEW.replacement_word);
  
  RETURN NEW;
END;
$$;

-- Create the validation trigger
DROP TRIGGER IF EXISTS validate_word_replacement ON public.word_replacements;
CREATE TRIGGER validate_word_replacement
  BEFORE INSERT OR UPDATE ON public.word_replacements
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_word_replacement_trigger();;
